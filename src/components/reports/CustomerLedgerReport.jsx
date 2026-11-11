import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { exportCustomerLedgerPDF } from '../../utils/pdfExportUtils';
import {
  Users,
  Search,
  Calendar,
  Download,
  Phone,
  MapPin,
  CreditCard,
  X,
  DollarSign
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { useCollections } from '../../hooks/useCollections';

export const CustomerLedgerReport = ({ initialCustomerId = null }) => {
  const { data, recordCustomerSettlement } = useApp();

  const { customers, sales, transactions } = useCollections();

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => formatMoney(val, currency, 'en-IN');

  // 1. ISOLATE CUSTOMER SEARCH STATE
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    if (initialCustomerId) return String(initialCustomerId);
    return customers.length > 0 ? String(customers[0].id) : null;
  });

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(String(initialCustomerId));
    }
  }, [initialCustomerId]);

  // Isolated Customer Profile
  const selectedCustomer = useMemo(() => {
    return customers.find(c => String(c.id) === String(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

  // Autocomplete matching customers
  const matchingCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.shopName && c.shopName.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.id && String(c.id).toLowerCase().includes(q))
    ).slice(0, 10);
  }, [customers, searchQuery]);

  // 2. DATE RANGE FILTER STATE
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const startOfMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  const [startDate, setStartDate] = useState(startOfMonthStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState('this-month');

  // Quick Preset Handlers
  const handlePresetChange = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'all-time') {
      setStartDate('2020-01-01');
      setEndDate(todayStr);
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this-month') {
      setStartDate(startOfMonthStr);
      setEndDate(todayStr);
    } else if (preset === 'last-month') {
      const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      const prevMonthStartDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setStartDate(prevMonthStartDay.toISOString().split('T')[0]);
      setEndDate(prevMonthLastDay.toISOString().split('T')[0]);
    } else if (preset === 'this-year') {
      setStartDate(`${now.getFullYear()}-01-01`);
      setEndDate(todayStr);
    }
  };

  // 3. SETTLEMENT MODAL STATE
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');

  // 4. TRANSACTION LEDGER COMPUTATION
  const ledgerData = useMemo(() => {
    if (!selectedCustomer) {
      return {
        openingBalance: 0,
        transactions: [],
        totalInvoiced: 0,
        totalPaid: 0,
        closingBalance: 0
      };
    }

    const cId = String(selectedCustomer.id);
    const cName = (selectedCustomer.name || '').toLowerCase();
    const cShop = (selectedCustomer.shopName || '').toLowerCase();
    const cPhone = String(selectedCustomer.phone || '').trim();

    // Collect all sales for this customer
    const rawSales = sales.filter(s => {
      if (s.customerId && String(s.customerId) === cId) return true;
      if (s.customerName && (s.customerName.toLowerCase() === cName || s.customerName.toLowerCase() === cShop)) return true;
      if (cPhone && s.customerPhone && String(s.customerPhone).trim() === cPhone) return true;
      return false;
    });

    // Collect settlement / payment transactions for this customer
    const rawTxns = transactions.filter(t => {
      const refMatch = t.reference && (t.reference === `CUST-${cId}` || t.reference === `CUST_${cId}`);
      const partyMatch = t.partyName && (t.partyName.toLowerCase().includes(cName) || t.partyName.includes(`#${cId}`));
      const isSettlement = t.type === 'Customer Settlement' || t.type === 'Customer Payment';
      return (refMatch || (isSettlement && partyMatch));
    });

    // Unify events into structured ledger entries
    const allEvents = [];

    // Sales events
    rawSales.forEach(s => {
      const date = (s.date ? s.date.slice(0, 10) : todayStr);
      const invoiceAmt = Number(s.totalAmount || 0);
      const isCredit = (s.paymentMethod || '').toLowerCase() === 'credit';
      const itemsDesc = s.itemsSummary || (Array.isArray(s.items) ? s.items.map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ') : 'POS Sale');

      // 1. Debit entry (charge to customer)
      allEvents.push({
        id: `INV-${s.invoiceNumber}`,
        rawDate: s.date || date,
        date,
        type: isCredit ? 'Credit Sale' : 'Sale (Paid)',
        reference: s.invoiceNumber,
        notes: itemsDesc,
        debit: invoiceAmt,
        credit: 0,
        paymentMethod: s.paymentMethod || 'Cash'
      });

      // 2. If paid at counter (Cash/UPI/Card), customer paid immediately -> Credit entry
      if (!isCredit && invoiceAmt > 0) {
        allEvents.push({
          id: `PAY-${s.invoiceNumber}`,
          rawDate: s.date || date,
          date,
          type: 'Counter Payment',
          reference: s.invoiceNumber,
          notes: `Paid at POS via ${s.paymentMethod || 'Cash'}`,
          debit: 0,
          credit: invoiceAmt,
          paymentMethod: s.paymentMethod || 'Cash'
        });
      }
    });

    // Customer settlements
    rawTxns.forEach(t => {
      const date = (t.date ? t.date.slice(0, 10) : todayStr);
      allEvents.push({
        id: t.id || `SETTLE-${Date.now()}`,
        rawDate: t.date || date,
        date,
        type: 'Settlement Payment',
        reference: t.reference || t.id,
        notes: t.notes || 'Customer debt payment',
        debit: 0,
        credit: Number(t.amount || 0),
        paymentMethod: t.paymentMethod || 'Cash'
      });
    });

    // Sort chronologically (earliest first)
    allEvents.sort((a, b) => new Date(a.rawDate || a.date).getTime() - new Date(b.rawDate || b.date).getTime());

    // Calculate Opening Balance (all transactions prior to startDate)
    let openingBalance = 0;
    const periodEvents = [];

    allEvents.forEach(ev => {
      if (ev.date < startDate) {
        openingBalance += (ev.debit - ev.credit);
      } else if (ev.date <= endDate) {
        periodEvents.push(ev);
      }
    });

    // Calculate running balance through the filtered period
    let currentRunning = openingBalance;
    let totalInvoiced = 0;
    let totalPaid = 0;

    const populatedTxns = periodEvents.map(ev => {
      currentRunning += (ev.debit - ev.credit);
      totalInvoiced += ev.debit;
      totalPaid += ev.credit;
      return {
        ...ev,
        runningBalance: currentRunning
      };
    });

    return {
      openingBalance,
      transactions: populatedTxns,
      totalInvoiced,
      totalPaid,
      closingBalance: currentRunning
    };
  }, [selectedCustomer, sales, transactions, startDate, endDate, todayStr]);

  // Export PDF Handler
  const handleExportPDF = () => {
    if (!selectedCustomer) return;
    exportCustomerLedgerPDF({
      customer: selectedCustomer,
      dateRange: { startDate, endDate },
      transactions: ledgerData.transactions,
      summary: ledgerData,
      settings: data?.settings || {},
      currency
    });
  };

  // Submit Settlement
  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !settleAmount || Number(settleAmount) <= 0) return;
    await recordCustomerSettlement(selectedCustomer.id, Number(settleAmount), settleMethod);
    setSettleModalOpen(false);
    setSettleAmount('');
  };

  return (
    <div className="space-y-6">
      {/* Search & Isolate Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        {/* Search Input & Dropdown Picker */}
        <div className="relative">
          <label className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
            Search & Isolate Customer Profile:
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, shop name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {searchQuery && matchingCustomers.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                Matching Profiles ({matchingCustomers.length})
              </div>
              {matchingCustomers.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomerId(String(c.id));
                    setSearchQuery('');
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 last:border-0 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">
                        {c.shopName ? `${c.shopName} (${c.name})` : c.name}
                      </span>
                      <span className="text-[11px] text-slate-400">{c.phone || 'No phone'} • {c.customerType || 'Retail'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">
                      {fmt(c.outstandingBalance)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Due Balance</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Swipeable Quick-Isolate Customer Chips (Mobile-First) */}
        {customers.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Quick Pick Account:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {customers.slice(0, 8).map(c => {
                const isSelected = selectedCustomer && String(selectedCustomer.id) === String(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomerId(String(c.id));
                      setSearchQuery('');
                    }}
                    className={`whitespace-nowrap px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      isSelected ? 'bg-white text-indigo-600' : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                    }`}>
                      {c.name ? c.name[0].toUpperCase() : 'C'}
                    </span>
                    <span className="truncate max-w-[120px]">{c.shopName || c.name}</span>
                    {Number(c.outstandingBalance || 0) > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      }`}>
                        {fmt(c.outstandingBalance)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Date Range Controls & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 block">
                From:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 block">
                To:
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPDF}
              icon={Download}
              className="flex-1 sm:flex-initial text-xs bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 py-2 sm:py-1.5"
            >
              Export to PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Date Preset Filter Pills (Scrollable on small screens) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <span className="text-xs font-bold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> Presets:
        </span>
        {[
          { id: 'this-month', label: 'This Month' },
          { id: 'last-month', label: 'Last Month' },
          { id: 'today', label: 'Today' },
          { id: 'all-time', label: 'All Time' },
          { id: 'this-year', label: 'This Year' }
        ].map(p => (
          <button
            key={p.id}
            onClick={() => handlePresetChange(p.id)}
            className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              activePreset === p.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ISOLATED CUSTOMER PROFILE CARD */}
      {selectedCustomer ? (
        <div className="bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-indigo-600/30">
                {selectedCustomer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {selectedCustomer.shopName ? `${selectedCustomer.shopName} — ${selectedCustomer.name}` : selectedCustomer.name}
                  </h3>
                  <Badge variant="info">{selectedCustomer.customerType || 'Retail'}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-indigo-500" />
                    {selectedCustomer.phone || 'No phone recorded'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    {selectedCustomer.address || 'Address on file'}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                    Limit: {fmt(selectedCustomer.creditLimit || 5000)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Settle Action */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSettleAmount(String(ledgerData.closingBalance > 0 ? ledgerData.closingBalance : ''));
                  setSettleModalOpen(true);
                }}
                icon={DollarSign}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm"
              >
                Record Payment Received
              </Button>
            </div>
          </div>

          {/* Financial Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-200/60 dark:border-neutral-800">
            <div className="bg-slate-50 dark:bg-neutral-900 p-3 rounded-xl border border-slate-200/60 dark:border-neutral-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Opening Balance</span>
              <span className="text-base font-black text-slate-700 dark:text-slate-300 mt-0.5 block">
                {fmt(ledgerData.openingBalance)}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-neutral-900 p-3 rounded-xl border border-slate-200/60 dark:border-neutral-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Invoiced in Period (+)</span>
              <span className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                {fmt(ledgerData.totalInvoiced)}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-neutral-900 p-3 rounded-xl border border-slate-200/60 dark:border-neutral-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paid / Settled in Period (-)</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {fmt(ledgerData.totalPaid)}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-neutral-900 p-3 rounded-xl border border-slate-200/60 dark:border-neutral-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Closing Balance Due</span>
              <span className={`text-base font-black mt-0.5 block ${ledgerData.closingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {fmt(ledgerData.closingBalance)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-800">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-200">No Customer Profile Isolated</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Use the search box above to isolate a customer account and inspect their complete debit, credit, and running balance ledger.
          </p>
        </div>
      )}

      {/* DETAILED TRANSACTION LEDGER (MOBILE FEED + DESKTOP TABLE) */}
      {selectedCustomer && (
        <Card
          title={`Statement Ledger: ${selectedCustomer.name}`}
          subtitle={`Movements from ${startDate} to ${endDate}`}
          icon={Users}
          action={
            <div className="flex items-center gap-2">
              <Badge variant={ledgerData.closingBalance > 0 ? 'danger' : 'success'}>
                {ledgerData.closingBalance > 0 ? `Due: ${fmt(ledgerData.closingBalance)}` : 'Account Settled'}
              </Badge>
            </div>
          }
          noPadding
        >
          {/* Mobile Card Feed (Ultra-simple for small screens) */}
          <div className="block md:hidden p-3 space-y-3">
            {/* Opening Balance Card */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex justify-between items-center text-xs">
              <div>
                <span className="font-extrabold text-slate-700 dark:text-slate-300 block">Opening Balance</span>
                <span className="text-[10px] text-slate-400">Brought forward before {startDate}</span>
              </div>
              <span className="font-black text-sm text-slate-900 dark:text-white">{fmt(ledgerData.openingBalance)}</span>
            </div>

            {ledgerData.transactions.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                No new sales or payments between {startDate} and {endDate}.
              </div>
            ) : (
              ledgerData.transactions.map((tx, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-slate-900 dark:text-white">{tx.date}</span>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">#{tx.reference}</span>
                    </div>
                    <Badge variant={tx.debit > 0 ? 'warning' : 'success'}>{tx.type}</Badge>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{tx.notes}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                    <span className="text-[10px] text-slate-400 font-medium">{tx.paymentMethod}</span>
                    <div className="flex items-center gap-2">
                      {tx.debit > 0 && <span className="font-bold text-indigo-600 dark:text-indigo-400">+{fmt(tx.debit)}</span>}
                      {tx.credit > 0 && <span className="font-bold text-emerald-600 dark:text-emerald-400">-{fmt(tx.credit)}</span>}
                      <span className="font-black text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px]">
                        Bal: {fmt(tx.runningBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Closing Balance Card */}
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex justify-between items-center text-xs font-bold">
              <div>
                <span className="text-slate-700 dark:text-slate-300 block">Closing Balance</span>
                <span className="text-[10px] text-slate-400">As of {endDate}</span>
              </div>
              <span className={`font-black text-sm ${ledgerData.closingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {fmt(ledgerData.closingBalance)}
              </span>
            </div>
          </div>

          {/* Desktop Tabular View (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Ref / Invoice #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description / Items</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Debit (+)</th>
                  <th className="py-3 px-4 text-right">Credit (-)</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {/* Opening Balance Row */}
                <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-300 font-bold">
                  <td className="py-3 px-4">{startDate}</td>
                  <td className="py-3 px-4 text-slate-400">—</td>
                  <td className="py-3 px-4">
                    <Badge variant="default">Opening Balance</Badge>
                  </td>
                  <td className="py-3 px-4 italic text-slate-500">Balance brought forward from previous periods</td>
                  <td className="py-3 px-4 text-slate-400">—</td>
                  <td className="py-3 px-4 text-right">—</td>
                  <td className="py-3 px-4 text-right">—</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                    {fmt(ledgerData.openingBalance)}
                  </td>
                </tr>

                {/* Filtered Transactions */}
                {ledgerData.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs italic">
                      No new sales or settlement transactions occurred for this customer between {startDate} and {endDate}.
                    </td>
                  </tr>
                ) : (
                  ledgerData.transactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {tx.reference || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={tx.debit > 0 ? 'warning' : 'success'}>
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-700 dark:text-slate-300">
                        {tx.notes}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {tx.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        {tx.debit > 0 ? fmt(tx.debit) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {tx.credit > 0 ? fmt(tx.credit) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                        {fmt(tx.runningBalance)}
                      </td>
                    </tr>
                  ))
                )}

                {/* Closing Balance Row */}
                <tr className="bg-slate-100/70 dark:bg-slate-800/70 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                  <td className="py-3 px-4">{endDate}</td>
                  <td className="py-3 px-4 uppercase text-[10px] tracking-wider text-slate-500">CLOSING TOTALS</td>
                  <td className="py-3 px-4">
                    <Badge variant={ledgerData.closingBalance > 0 ? 'danger' : 'success'}>Closing</Badge>
                  </td>
                  <td className="py-3 px-4">Statement Ending Position</td>
                  <td className="py-3 px-4 text-slate-400">—</td>
                  <td className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400">
                    {fmt(ledgerData.totalInvoiced)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                    {fmt(ledgerData.totalPaid)}
                  </td>
                  <td className={`py-3 px-4 text-right text-sm ${ledgerData.closingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {fmt(ledgerData.closingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Settle Debt Modal */}
      {settleModalOpen && selectedCustomer && (
        <Modal
          isOpen={settleModalOpen}
          onClose={() => setSettleModalOpen(false)}
          title={`Record Debt Settlement — ${selectedCustomer.name}`}
        >
          <form onSubmit={handleSettleSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200">
              Current Outstanding Balance: <strong>{fmt(ledgerData.closingBalance)}</strong>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Amount Received ({currency}):
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Enter amount paid"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Payment Method:
              </label>
              <select
                value={settleMethod}
                onChange={(e) => setSettleMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="UPI / Online">UPI / QR Code</option>
                <option value="Card">Credit / Debit Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                type="button"
                onClick={() => setSettleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Confirm Settlement
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
