/**
 * Boxy — Native (Capacitor) bridge
 *
 * Single place where the web app talks to the Android shell. Every helper
 * degrades to the normal browser behaviour when running on the web, so callers
 * never need to branch on platform themselves.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Network } from '@capacitor/network';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Local plugin implemented in android/app/src/main/java/.../BoxyPrintPlugin.java
const BoxyPrint = registerPlugin('BoxyPrint');

export const isNative = () => Capacitor.isNativePlatform();

/* ------------------------------------------------------------------------ */
/* App lifecycle                                                             */
/* ------------------------------------------------------------------------ */

/**
 * Run `callback` whenever the app returns to the foreground.
 * Returns an unsubscribe function. Works on web via visibilitychange.
 */
export const onAppResume = (callback) => {
  if (isNative()) {
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) callback();
    });
    return () => { handle.then(h => h.remove()); };
  }
  if (typeof document === 'undefined') return () => {};
  const onVisible = () => { if (document.visibilityState === 'visible') callback(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
};

const isExternalUrl = (href) => {
  try {
    const url = new URL(href, window.location.href);
    if (!/^https?:$/.test(url.protocol)) return /^(tel|mailto|whatsapp|intent):/.test(url.protocol);
    return url.host !== window.location.host;
  } catch {
    return false;
  }
};

/**
 * Open a URL outside the app (WhatsApp, Google Sheets, browser…).
 * On Android, navigating the WebView to a foreign host is handed to the OS,
 * which opens the matching app or the system browser.
 */
export const openExternal = (url) => {
  if (isNative()) {
    window.location.href = url;
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};

let shellInitialised = false;

/**
 * One-time native shell setup: status bar, splash, hardware back button,
 * external links and connectivity events. No-op on the web.
 */
export const initNativeShell = async () => {
  if (!isNative() || shellInitialised) return;
  shellInitialised = true;

  // Android hardware back: navigate back in-app, exit from the root screen.
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && window.location.pathname !== '/') window.history.back();
    else App.exitApp();
  });

  // target="_blank" links would otherwise be swallowed by the WebView.
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.hasAttribute('download')) return;
    if (!isExternalUrl(anchor.getAttribute('href'))) return;
    event.preventDefault();
    openExternal(anchor.href);
  }, true);

  // The WebView's navigator.onLine is unreliable on some devices; mirror the
  // native network state into the standard online/offline events.
  Network.addListener('networkStatusChange', ({ connected }) => {
    window.dispatchEvent(new Event(connected ? 'online' : 'offline'));
  });
  try {
    const { connected } = await Network.getStatus();
    if (!connected) window.dispatchEvent(new Event('offline'));
  } catch { /* ignore */ }

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });
  } catch { /* status bar styling is cosmetic */ }

  try { await SplashScreen.hide(); } catch { /* ignore */ }
};

/* ------------------------------------------------------------------------ */
/* Files: save + share                                                       */
/* ------------------------------------------------------------------------ */

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const toBase64 = async (data) => {
  if (data instanceof Blob) return blobToBase64(data);
  const str = String(data);
  if (str.startsWith('data:')) return str.split(',')[1] || '';
  return str; // already base64
};

const safeName = (name) => String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_');

/**
 * Write a file into the app cache and open the Android share sheet so the
 * user can save it (Files / Drive) or send it (WhatsApp, Gmail…).
 * `data` may be a Blob, a data: URL or a raw base64 string.
 */
export const shareFileNative = async (data, fileName, { title, text } = {}) => {
  const path = `exports/${safeName(fileName)}`;
  const { uri } = await Filesystem.writeFile({
    path,
    data: await toBase64(data),
    directory: Directory.Cache,
    recursive: true
  });
  try {
    await Share.share({ title: title || fileName, text, files: [uri], dialogTitle: title || `Share ${fileName}` });
  } catch (err) {
    // User closing the share sheet is not an error.
    if (!/cancel/i.test(err?.message || '')) throw err;
  }
  return fileName;
};

/**
 * Save a file: browser download on the web, share sheet on Android.
 * `data` may be a Blob, a data: URL, or a string with `mimeType` given.
 */
export const saveFile = async (data, fileName, mimeType = 'application/octet-stream') => {
  const blob = (data instanceof Blob)
    ? data
    : String(data).startsWith('data:')
      ? await (await fetch(data)).blob()
      : new Blob([data], { type: mimeType });

  if (isNative()) return shareFileNative(blob, fileName);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
};

/* ------------------------------------------------------------------------ */
/* Printing                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Print a complete HTML document.
 * - Android: native PrintManager (Wi-Fi/Bluetooth printers or "Save as PDF").
 * - Web: popup window + window.print().
 */
export const printHtml = async (html, { jobName = 'Boxy Document', width = 800, height = 750 } = {}) => {
  if (isNative()) {
    // Root-relative assets ("/logo.jpg") are resolved against the bundled web assets.
    const nativeHtml = html.replace(/(src|href)="\/(?!\/)/g, '$1="');
    await BoxyPrint.printHtml({ html: nativeHtml, jobName });
    return;
  }

  const printWindow = window.open('', '_blank', `width=${width},height=${height}`);
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);
};
