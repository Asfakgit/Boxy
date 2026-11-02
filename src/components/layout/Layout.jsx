import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { ToastContainer } from '../ui/Toast';
import logoImg from '../../assets/logo.jpeg';
import {
  LayoutDashboard,
  ShoppingBag,
  Receipt,
  ArrowLeftRight,
  Truck,
  Package,
  Users,
  Building2,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Menu as MenuIcon,
  X,
  ChevronRight,
  Flame,
  RefreshCw
} from 'lucide-react';

const PAGE_TITLES = {
  '/': 'Kitchen Dashboard',
  '/pos': 'POS Billing',
  '/orders': 'Orders & Invoice History',
  '/transactions': 'Cash Flow Ledger',
  '/purchases': 'Purchases & Restocking',
  '/items': 'Stock & Inventory Management',
  '/customers': 'Customers Directory',
  '/suppliers': 'Suppliers Directory',
  '/reports': 'Financial Reports',
  '/settings': 'Settings'
};

const NAVIGATION_SECTIONS = [
  {
    title: 'Sales & POS',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'POS Billing', path: '/pos', icon: ShoppingBag, badge: 'Live' },
      { name: 'Orders & Invoices', path: '/orders', icon: Receipt },
    ]
  },
  {
    title: 'Kitchen & Inventory',
    items: [
      { name: 'Stock & Items', path: '/items', icon: Package },
      { name: 'Purchases & Restock', path: '/purchases', icon: Truck },
      { name: 'Cash Flow Ledger', path: '/transactions', icon: ArrowLeftRight },
    ]
  },
  {
    title: 'Directory & Admin',
    items: [
      { name: 'Customers', path: '/customers', icon: Users },
      { name: 'Suppliers', path: '/suppliers', icon: Building2 },
      { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
      { name: 'Settings', path: '/settings', icon: SettingsIcon },
    ]
  }
];

const PAGE_ICONS = {
  '/': LayoutDashboard,
  '/pos': ShoppingBag,
  '/orders': Receipt,
  '/transactions': ArrowLeftRight,
  '/purchases': Truck,
  '/items': Package,
  '/customers': Users,
  '/suppliers': Building2,
  '/reports': FileSpreadsheet,
  '/settings': SettingsIcon
};

export const Layout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { refreshData, isSyncing } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const PageIcon = PAGE_ICONS[location.pathname] || Flame;
  const pageTitle = PAGE_TITLES[location.pathname] || 'Boxy Cloud Kitchen';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 select-none">
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 backdrop-blur-md z-30 flex-shrink-0">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 dark:border-slate-800/80">
          <img
            src={logoImg}
            alt="Boxy Logo"
            className="w-10 h-10 rounded-2xl object-cover shadow-md shadow-amber-500/25 ring-2 ring-amber-400/40"
          />
          <div>
            <h1 className="font-black text-base text-slate-900 dark:text-white leading-tight tracking-tight">Boxy</h1>
            <p className="text-[11px] text-slate-400 font-medium">Cloud Kitchen POS & ERP</p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
          {NAVIGATION_SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 group
                      ${isActive 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'}
                    `}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        isActive 
                          ? 'bg-white/20 text-white shadow-2xs' 
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/60 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                      }`}>
                        <Icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2.2 : 1.75} />
                      </div>
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${isActive ? 'bg-indigo-500 text-white' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300'}`}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Quick Sync */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => refreshData()}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Database'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-20 flex items-center justify-between px-4 md:px-8 flex-shrink-0">
          {/* Left: Mobile Menu Button & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Open Navigation Menu"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60">
                <PageIcon className="w-4 h-4" strokeWidth={1.8} />
              </div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                {pageTitle}
              </h2>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick POS Button */}
            {location.pathname !== '/pos' && (
              <button
                onClick={() => navigate('/pos')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold text-xs shadow-sm shadow-indigo-600/20 active:scale-95 transition-all"
              >
                <ShoppingBag className="w-3.5 h-3.5" strokeWidth={2} />
                <span>POS Sale</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-700/60 transition-colors"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" strokeWidth={2} /> : <Moon className="w-4 h-4 text-indigo-600" strokeWidth={2} />}
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 dark:bg-slate-950 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 z-40 flex items-center justify-around px-2 shadow-lg">
          {[
            { name: 'POS', path: '/pos', icon: ShoppingBag },
            { name: 'Dashboard', path: '/', icon: LayoutDashboard },
            { name: 'Orders', path: '/orders', icon: Receipt },
            { name: 'Ledger', path: '/transactions', icon: ArrowLeftRight },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={`
                  relative flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-colors
                  ${isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] mt-1 font-semibold">{tab.name}</span>
              </NavLink>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center w-16 py-1 text-slate-500 dark:text-slate-400"
          >
            <MenuIcon className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-semibold">More</span>
          </button>
        </nav>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex animate-fadeIn">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-80 max-w-[85vw] bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 animate-slideRight">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={logoImg}
                  alt="Boxy Logo"
                  className="w-9 h-9 rounded-xl object-cover shadow-md shadow-amber-500/25 ring-2 ring-amber-400/40"
                />
                <div>
                  <span className="font-extrabold text-base block text-slate-900 dark:text-white">Boxy</span>
                  <span className="text-[10px] text-slate-400 block font-medium">Cloud Kitchen ERP</span>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {NAVIGATION_SECTIONS.map((section, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="px-3 text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">{section.title}</p>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`
                          flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors
                          ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 opacity-50" />
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/settings'); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs"
              >
                <span>Google Sheets Connection Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Banner */}
      <ToastContainer />
    </div>
  );
};
