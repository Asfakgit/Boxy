package com.boxy.cloudkitchen;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Prints an HTML document through Android's PrintManager. The system dialog
 * lets the user pick a Wi-Fi / Bluetooth printer service or "Save as PDF".
 */
@CapacitorPlugin(name = "BoxyPrint")
public class BoxyPrintPlugin extends Plugin {

    // PrintManager needs the WebView alive until the print job has been spooled.
    private WebView printWebView;

    @PluginMethod
    public void printHtml(PluginCall call) {
        final String html = call.getString("html");
        final String jobName = call.getString("jobName", "Boxy Document");
        if (html == null || html.isEmpty()) {
            call.reject("html is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            WebView webView = new WebView(getContext());
            webView.getSettings().setJavaScriptEnabled(false);
            webView.setWebViewClient(new WebViewClient() {
                private boolean printed = false;

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return true; // never navigate away from the document
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    if (printed) return;
                    printed = true;
                    try {
                        PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                        printManager.print(jobName, adapter, new PrintAttributes.Builder().build());
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("Unable to start printing: " + e.getMessage(), e);
                    }
                }
            });
            printWebView = webView;
            // Relative asset paths (e.g. "logo.jpg") resolve to the bundled web assets.
            webView.loadDataWithBaseURL("file:///android_asset/public/", html, "text/html", "UTF-8", null);
        });
    }
}
