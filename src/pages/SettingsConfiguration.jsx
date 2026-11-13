import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  Save,
  RefreshCw,
  Moon,
  Sun,
  CheckCircle2,
  Cloud,
  HardDrive,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Upload,
  RotateCcw,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { DEFAULT_SHEET_URL } from '../services/apiService';
import { saveFile } from '../utils/nativeBridge';

export const SettingsConfiguration = () => {
  const { data, saveSettings, forceSyncFromSheets, clearAllDatabaseData, showConfirmDialog, isLoading, isSyncing } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, changeCredentials } = useAuth();

  // Settings State
  const [logo, setLogo] = useState(data?.settings?.logo || '/logo.jpg');
  const [currencySymbol, setCurrencySymbol] = useState(data?.settings?.currencySymbol || '₹');
  const [taxRate, setTaxRate] = useState(String(data?.settings?.taxRate ?? '0'));
  const [companyName, setCompanyName] = useState(data?.settings?.companyName || 'Boxy Cloud Kitchen');
  const [invoiceFooter, setInvoiceFooter] = useState(
    data?.settings?.invoiceFooter || 'Thank you for choosing Boxy Cloud Kitchen! Freshness & speed guaranteed.'
  );

  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Security Credentials State
  const [oldPassword, setOldPassword] = useState('');
  const [editUsername, setEditUsername] = useState(currentUser?.username || 'Boxy');
  const [editPassword, setEditPassword] = useState('');
  const [credMessage, setCredMessage] = useState(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setLogo(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateCredentials = (e) => {
    e.preventDefault();
    setCredMessage(null);
    if (!oldPassword) {
      setCredMessage({ type: 'error', text: 'Please enter your current password to confirm changes.' });
      return;
    }
    const res = changeCredentials(oldPassword, editUsername, editPassword || oldPassword);
    if (res.success) {
      setCredMessage({ type: 'success', text: 'Login credentials updated successfully!' });
      setOldPassword('');
      setEditPassword('');
      setTimeout(() => setCredMessage(null), 4000);
    } else {
      setCredMessage({ type: 'error', text: res.error || 'Failed to update credentials.' });
    }
  };

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    const updated = {
      ...(data?.settings || {}),
      logo,
      companyName,
      currencySymbol,
      taxRate: Number(taxRate || 0),
      invoiceFooter
    };
    await saveSettings(updated);
  };

  const handleManualSync = async () => {
    try {
      await forceSyncFromSheets();
      setLastSyncTime(new Date().toLocaleTimeString());
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadBackup = () => {
    saveFile(
      JSON.stringify(data, null, 2),
      `Boxy_Backup_${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    ).catch(err => console.error('Backup export failed:', err));
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Settings</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Cloud database synchronization, kitchen branding, and system preferences
        </p>
      </div>

      {/* Cloud Sync Only Section */}
      <Card
        title="Database Synchronization"
        subtitle="Automatic cloud synchronization for POS orders, kitchen stock, and cash flow"
        className="border-indigo-500/30 bg-gradient-to-br from-indigo-50/30 via-white to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900"
      >
        <div className="pt-2">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/60 shadow-xs">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Cloud Database
                  </h4>
                  <Badge variant="success">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
                    Connected & Live
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  All transactions, menu items, and stock updates synchronize automatically.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Last synchronized at <strong className="text-slate-700 dark:text-slate-300">{lastSyncTime}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <a
                href={DEFAULT_SHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                <span>Open Google Sheet</span>
              </a>
              <Button
                type="button"
                variant="primary"
                icon={RefreshCw}
                onClick={handleManualSync}
                isLoading={isSyncing || isLoading}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-xs font-bold px-5 py-2.5 shadow-sm"
              >
                {isSyncing || isLoading ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </div>

          {syncSuccess && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Database synchronized successfully! All records are up to date.</span>
            </div>
          )}
        </div>
      </Card>

      {/* Kitchen Profile & Receipts */}
      <Card
        title="Kitchen Profile & Receipt Branding"
        subtitle="Manage business information printed on customer receipts and POS invoices"
      >
        <form onSubmit={handleSaveGeneral} className="space-y-4 pt-2">
          {/* Brand Logo Showcase & Upload */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-4">
              <img
                src={logo || '/logo.jpg'}
                alt="Brand Logo"
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-amber-400/50 shadow-md shadow-amber-500/20 shrink-0 bg-slate-900"
              />
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Official Brand Logo</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Appears on Sidebar, POS Receipts, Order Invoices, Login screen, and Dashboard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label
                htmlFor="settings-logo-input"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Change Logo</span>
              </label>
              <input
                id="settings-logo-input"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              {logo !== '/logo.jpg' && (
                <button
                  type="button"
                  onClick={() => setLogo('/logo.jpg')}
                  className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 transition-colors"
                  title="Reset to default logo"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Company / Kitchen Name *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Boxy Cloud Kitchen"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Currency Symbol *</label>
              <input
                type="text"
                required
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="₹"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">GST / Tax Rate (%)</label>
            <input
              type="number"
              step="any"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
            />
            <p className="text-[11px] text-slate-400 mt-1">Default is 0%. When 0, GST is omitted from bills unless added during POS checkout.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Receipt Footer Note</label>
            <input
              type="text"
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
              placeholder="Thank you for dining with Boxy Cloud Kitchen!"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" icon={Save} isLoading={isLoading}>
              Update Kitchen Profile
            </Button>
          </div>
        </form>
      </Card>

      {/* Security & Login Credentials */}
      <Card
        title="Security & Login Credentials"
        subtitle="Manage your ERP login username and password"
      >
        <form onSubmit={handleUpdateCredentials} className="space-y-4 pt-2">
          {/* Active User Pill */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm uppercase">
                {currentUser?.username?.[0] || 'A'}
              </div>
              <div>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white block">
                  {currentUser?.name || currentUser?.username}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Active User Role: <strong className="text-indigo-600 dark:text-indigo-400">{currentUser?.role || 'Administrator'}</strong>
                </span>
              </div>
            </div>

            <Badge variant="info">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Protected Session
            </Badge>
          </div>

          {credMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                credMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {credMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{credMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                New Username
              </label>
              <input
                type="text"
                required
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="e.g. admin"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                New Password (leave blank to keep current)
              </label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Current Password (required to save changes) *
            </label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter current password to verify"
              className="w-full sm:w-1/2 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" icon={KeyRound} className="bg-indigo-600 hover:bg-indigo-700 text-xs">
              Save New Credentials
            </Button>
          </div>
        </form>
      </Card>

      {/* Interface Theme Preferences */}
      <Card title="Interface & Theme Preferences">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white">
              {theme === 'dark' ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
            </div>
            <div>
              <h5 className="font-bold text-sm text-slate-900 dark:text-white">Dark / Light Interface</h5>
              <p className="text-xs text-slate-500">Currently active mode: <strong className="uppercase text-indigo-600">{theme}</strong></p>
            </div>
          </div>
          <Button onClick={toggleTheme} variant="secondary" size="sm">
            Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </Button>
        </div>
      </Card>

      {/* Data Backups & Reset */}
      <Card title="Data Management & Backups">
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white mb-1">
                <HardDrive className="w-4 h-4 text-indigo-600" />
                <span>Download Database JSON Backup</span>
              </div>
              <p className="text-xs text-slate-500">Export all records (Items, Sales, Purchases, Transactions) for offline safety.</p>
            </div>
            <Button onClick={handleDownloadBackup} variant="secondary" size="sm" className="shrink-0">
              Download Backup (.json)
            </Button>
          </div>

          <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/30 dark:bg-rose-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-bold text-sm text-rose-600 dark:text-rose-400 mb-1">
                <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Remove All Data (Site & Google Sheets)</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Permanently wipes all sales, orders, items, customers, suppliers, and cash flow transactions from both the website and Google Sheets database.
              </p>
            </div>
            <Button
              onClick={() => {
                showConfirmDialog({
                  title: 'Wipe All Database Data?',
                  message: 'Are you sure you want to delete ALL data from the website and Google Sheets? This includes all orders, menu products, raw materials, customers, suppliers, and transaction records. This action cannot be undone.',
                  type: 'danger',
                  confirmText: 'Yes, Wipe All Data',
                  onConfirm: clearAllDatabaseData
                });
              }}
              variant="outline"
              size="sm"
              className="shrink-0 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-colors"
            >
              Clear All Data
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
