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
  AlertCircle
} from 'lucide-react';

export const SettingsConfiguration = () => {
  const { data, saveSettings, forceSyncFromSheets, isLoading, isSyncing } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, changeCredentials } = useAuth();

  // Settings State
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
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Boxy_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
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
          {/* Brand Logo Showcase */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <img
              src="/logo.jpg"
              alt="Official Kitchen Logo"
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-amber-400/50 shadow-md shadow-amber-500/20 shrink-0"
            />
            <div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Official Brand Logo Active</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Featured across the sidebar header, POS receipts, order history invoices, items list, and browser tab favicon.
              </p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Established Year</label>
              <input
                type="text"
                value="2022"
                disabled
                className="w-full px-3.5 py-2.5 text-sm bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 font-semibold cursor-not-allowed"
              />
            </div>
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

      {/* Data Backups */}
      <Card title="Data Management & Backups">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
      </Card>
    </div>
  );
};
