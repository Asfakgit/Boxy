import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { exportBalanceSheetPDF } from '../../utils/pdfExportUtils';
import { calculateLabourSummary, calculatePartnerSummary } from '../../utils/partnerLabourUtils';
import logoImg from '../../assets/logo.jpeg';
import {
  Scale,
  Calendar,
  Download,
  TrendingUp,
  Wallet,
  Building,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { useCollections } from '../../hooks/useCollections';

export const BalanceSheetReport = () => {
  const { data, refreshData } = useApp();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [asOfDate, setAsOfDate] = useState(todayStr);

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => formatMoney(val, currency, 'en-IN');

  const { sales, purchases, expenses, transactions, products, rawMaterials, customers, suppliers } = useCollections();

  const balanceSheet = useMemo(() => {
    // Filter items up to asOfDate
    const isUpToDate = (dateStr) => {
      if (!dateStr) return true;
      const itemDate = dateStr.slice(0, 10);
      return itemDate <= asOfDate;
    };

    // 1. ASSETS CALCULATION (100% Real Database Records)
    const filteredTxns = transactions.filter(t => isUpToDate(t.date));

    // Cash and Bank Balances from Real Cash Flow Transactions
    let cashInHand = 0;
    let bankBalances = 0;

    filteredTxns.forEach(t => {
      const amt = Number(t.amount || 0);
      const isCash = (t.paymentMethod || 'Cash').toLowerCase() === 'cash';
      if (t.flow === 'IN') {
        if (isCash) cashInHand += amt;
        else bankBalances += amt;
      } else if (t.flow === 'OUT') {
        if (isCash) cashInHand -= amt;
        else bankBalances -= amt;
      }
    });

    if (cashInHand < 0 && bankBalances > Math.abs(cashInHand)) {
      bankBalances += cashInHand;
      cashInHand = 0;
    }
    const totalCash = Math.max(0, cashInHand) + Math.max(0, bankBalances);

    // Accounts Receivable (Real Customer Credit Dues)
    const accountsReceivable = customers.reduce((sum, c) => sum + Math.max(0, Number(c.outstandingBalance || 0)), 0);

    // Inventory on Hand (Real Stock * Cost Price)
    const productsInventory = products.reduce((sum, p) => {
      const stock = Math.max(0, Number(p.currentStock || 0));
      const cost = Number(p.costPrice || p.price || 0);
      return sum + (stock * cost);
    }, 0);

    const rawMaterialsInventory = rawMaterials.reduce((sum, rm) => {
      const stock = Math.max(0, Number(rm.currentStock || 0));
      const cost = Number(rm.costPrice || 0);
      return sum + (stock * cost);
    }, 0);

    const totalInventory = productsInventory + rawMaterialsInventory;

    // Real Total Assets
    const totalAssets = totalCash + accountsReceivable + totalInventory;

    // 2. LIABILITIES CALCULATION (100% Real Records)
    // Accounts Payable (Real Outstanding Supplier Dues)
    const accountsPayable = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.outstandingBalance || 0)), 0);

    // Tax Payable (Real GST Output Collected from Sales)
    const filteredSales = sales.filter(s => isUpToDate(s.date));
    const taxPayable = filteredSales.reduce((sum, s) => sum + Number(s.taxAmount || 0), 0);

    // Labour Salaries Payable (Accrued wages unpaid up to date)
    const labourSummary = calculateLabourSummary({
      labourers: data?.labourers || [],
      salaryPayments: data?.salaryPayments || [],
      attendance: data?.attendance || [],
      filterStartDate: '',
      filterEndDate: asOfDate
    });
    const salariesPayable = Math.max(0, Number(labourSummary.totalPending || 0));

    // Real Total Liabilities
    const totalLiabilities = accountsPayable + taxPayable + salariesPayable;

    // 3. EQUITY CALCULATION (Real Business Net Worth & Cumulative Profits)
    // Retained Earnings = Cumulative Net Income up to date (Revenue - COGS - Expenses)
    const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const filteredPurchases = purchases.filter(p => isUpToDate(p.date));
    const totalPurchasesCost = filteredPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
    const filteredExpenses = expenses.filter(e => isUpToDate(e.date));
    const totalExpCost = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const retainedEarnings = totalRevenue - totalPurchasesCost - totalExpCost;

    // Partner Equity Breakdown
    const partnerSummary = calculatePartnerSummary({
      partners: data?.partners || [],
      withdrawals: data?.partnerWithdrawals || [],
      sales,
      purchases,
      expenses,
      salaryPayments: data?.salaryPayments || [],
      filterStartDate: '',
      filterEndDate: asOfDate
    });

    // Real Net Worth (Total Assets - Total Liabilities)
    const totalEquity = totalAssets - totalLiabilities;
    const initialCapital = totalEquity - retainedEarnings;
    const totalLiabAndEquity = totalLiabilities + totalEquity;

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabAndEquity,
      assets: {
        cashInHand: Math.max(0, cashInHand),
        bankBalances: Math.max(0, bankBalances),
        totalCash,
        accountsReceivable,
        productsInventory,
        rawMaterialsInventory,
        totalInventory,
        totalCurrentAssets: totalAssets
      },
      liabilities: {
        accountsPayable,
        taxPayable,
        salariesPayable,
        totalCurrentLiabilities: totalLiabilities,
        totalLiabilities
      },
      equity: {
        initialCapital,
        retainedEarnings,
        totalEquity,
        partnersEquity: (partnerSummary.partners || []).map(p => ({
          name: p.name,
          percentage: p.percentage,
          allocatedProfit: p.allocatedProfit,
          withdrawals: p.totalWithdrawals,
          balance: p.remainingBalance
        }))
      }
    };
  }, [transactions, sales, purchases, expenses, products, rawMaterials, customers, suppliers, data?.labourers, data?.salaryPayments, data?.attendance, data?.partners, data?.partnerWithdrawals, asOfDate]);

  // Export to PDF with embedded logo
  const handleExportPDF = async () => {
    let logoDataUrl = data?.settings?.logo || '';
    if (!logoDataUrl.startsWith('data:image')) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 120;
            canvas.height = img.naturalHeight || 120;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            logoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = data?.settings?.logo || logoImg;
        });
      } catch (err) {
        console.warn('Could not encode logo for PDF:', err);
      }
    }

    exportBalanceSheetPDF({
      balanceSheetData: balanceSheet,
      asOfDate,
      settings: {
        ...(data?.settings || {}),
        logo: logoDataUrl || data?.settings?.logo
      },
      currency
    });
  };

  // Solvency & Health Ratios
  const workingCapital = balanceSheet.totalAssets - balanceSheet.totalLiabilities;
  const currentRatio = balanceSheet.totalLiabilities > 0
    ? (balanceSheet.totalAssets / balanceSheet.totalLiabilities).toFixed(2)
    : 'Strong (No Debt)';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Brand Header with Kitchen Logo */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src={data?.settings?.logo || logoImg}
            alt="Brand Logo"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover ring-2 ring-indigo-500/30 shadow-md shadow-indigo-500/15 shrink-0 bg-slate-900"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
              {data?.settings?.companyName || 'Boxy Cloud Kitchen'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Balance Sheet & Statement of Financial Position (100% Real Records)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPDF}
            icon={Download}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
          >
            Export to PDF
          </Button>
        </div>
      </div>

      {/* Control Bar: Date Selector & Presets */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* As of Date Selector */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1 sm:flex-initial">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">As of Date</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <button
              onClick={() => setAsOfDate(todayStr)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                asOfDate === todayStr
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                setAsOfDate(lastMonthEnd);
              }}
              className="whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
            >
              Last Month End
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const startOfYear = `${now.getFullYear()}-01-01`;
                setAsOfDate(startOfYear);
              }}
              className="whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
            >
              Start of Year
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              icon={RefreshCw}
              className="text-xs h-7 ml-1"
              title="Refresh Real Data"
            >
              Sync
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Assets</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400">
              <Scale className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmt(balanceSheet.totalAssets)}</h3>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Cash & Inventory at cost
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Liabilities</span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-neutral-900 text-rose-600 dark:text-rose-400">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmt(balanceSheet.totalLiabilities)}</h3>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Suppliers, Wages & Tax
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Owner's Equity</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmt(balanceSheet.totalEquity)}</h3>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Cumulative net business worth
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Working Capital</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmt(workingCapital)}</h3>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Current ratio: {currentRatio}
            </p>
          </div>
        </div>
      </div>

      {/* Main Breakdown: Side-by-Side Real Balance Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ASSETS COLUMN */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-indigo-500 pb-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              1. OPERATIONAL ASSETS
            </h3>
            <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">{fmt(balanceSheet.totalAssets)}</span>
          </div>

          {/* Current Assets Card */}
          <Card className="border-l-4 border-l-indigo-500" noPadding>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">Real Cash, Stock & Receivables</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">{fmt(balanceSheet.totalAssets)}</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              <div className="px-5 py-2.5 flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Cash in Hand (Physical Register)</span>
                <span className="font-semibold text-slate-900 dark:text-white">{fmt(balanceSheet.assets.cashInHand)}</span>
              </div>
              <div className="px-5 py-2.5 flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Bank Accounts & Digital Float (UPI / Cards)</span>
                <span className="font-semibold text-slate-900 dark:text-white">{fmt(balanceSheet.assets.bankBalances)}</span>
              </div>
              <div className="px-5 py-2.5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Total Cash & Cash Equivalents</span>
                <span className="text-slate-900 dark:text-white">{fmt(balanceSheet.assets.totalCash)}</span>
              </div>
              <div className="px-5 py-2.5 flex justify-between items-center">
                <div>
                  <span className="text-slate-600 dark:text-slate-400 block">Accounts Receivable (Debtors)</span>
                  <span className="text-[10px] text-slate-400">Receivable from credit customers ({customers.length} profiles)</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">{fmt(balanceSheet.assets.accountsReceivable)}</span>
              </div>
              <div className="px-5 py-2.5 flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Finished Goods Inventory</span>
                <span className="font-semibold text-slate-900 dark:text-white">{fmt(balanceSheet.assets.productsInventory)}</span>
              </div>
              <div className="px-5 py-2.5 flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Kitchen Raw Materials Inventory</span>
                <span className="font-semibold text-slate-900 dark:text-white">{fmt(balanceSheet.assets.rawMaterialsInventory)}</span>
              </div>
              <div className="px-5 py-2.5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Total Inventory at Cost</span>
                <span className="text-slate-900 dark:text-white">{fmt(balanceSheet.assets.totalInventory)}</span>
              </div>
            </div>
          </Card>

          {/* Total Assets Summary Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 flex justify-between items-center">
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-neutral-200 uppercase tracking-wide">GRAND TOTAL REAL ASSETS</span>
            <span className="text-base font-black text-indigo-600 dark:text-indigo-400">{fmt(balanceSheet.totalAssets)}</span>
          </div>
        </div>

        {/* LIABILITIES & EQUITY COLUMN */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-rose-500 pb-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              2. LIABILITIES & EQUITY
            </h3>
            <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">{fmt(balanceSheet.totalLiabAndEquity)}</span>
          </div>

          {/* Current Liabilities Card */}
          <Card className="border-l-4 border-l-rose-500" noPadding>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">Real Liabilities & Payables</span>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{fmt(balanceSheet.totalLiabilities)}</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              <div className="px-5 py-2.5 flex justify-between items-center">
                <div>
                  <span className="text-slate-600 dark:text-slate-400 block">Accounts Payable (Trade Creditors)</span>
                  <span className="text-[10px] text-slate-400">Payable to ingredient suppliers ({suppliers.length} vendors)</span>
                </div>
                <span className="font-semibold text-rose-600 dark:text-rose-400">{fmt(balanceSheet.liabilities.accountsPayable)}</span>
              </div>
              <div className="px-5 py-2.5 flex justify-between items-center">
                <div>
                  <span className="text-slate-600 dark:text-slate-400 block">Salaries & Wages Payable</span>
                  <span className="text-[10px] text-slate-400">Accrued pending wages owed to kitchen staff</span>
                </div>
                <span className="font-semibold text-rose-600 dark:text-rose-400">{fmt(balanceSheet.liabilities.salariesPayable)}</span>
              </div>
              <div className="px-5 py-2.5 flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Taxes & GST Output Payable</span>
                <span className="font-semibold text-slate-900 dark:text-white">{fmt(balanceSheet.liabilities.taxPayable)}</span>
              </div>
              <div className="px-5 py-2.5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Total Recorded Liabilities</span>
                <span className="text-rose-600 dark:text-rose-400">{fmt(balanceSheet.totalLiabilities)}</span>
              </div>
            </div>
          </Card>

          {/* Owner Equity Card */}
          <Card className="border-l-4 border-l-emerald-500" noPadding>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">Real Owner Equity & Accumulated Profit</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(balanceSheet.totalEquity)}</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              <div className="px-5 py-2.5 flex justify-between items-center">
                <div>
                  <span className="text-slate-600 dark:text-slate-400 block">Retained Earnings (Accumulated Net Profit)</span>
                  <span className="text-[10px] text-slate-400">Total cumulative net business earnings (Revenue - Purchases - Expenses)</span>
                </div>
                <span className={`font-semibold ${balanceSheet.equity.retainedEarnings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {fmt(balanceSheet.equity.retainedEarnings)}
                </span>
              </div>
              {balanceSheet.equity.partnersEquity?.length > 0 && (
                <div className="bg-slate-50/70 dark:bg-neutral-900/40 px-5 py-3 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Partner Capital & Undrawn Balances
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {balanceSheet.equity.partnersEquity.map((p, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-black border border-slate-200/80 dark:border-neutral-800 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-neutral-300">
                          <span>{p.name}</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{p.percentage}%</span>
                        </div>
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
                          {fmt(p.balance)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Allocated: {fmt(p.allocatedProfit)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="px-5 py-2.5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Total Real Net Business Worth (Equity)</span>
                <span className="text-emerald-600 dark:text-emerald-400">{fmt(balanceSheet.totalEquity)}</span>
              </div>
            </div>
          </Card>

          {/* Total Liabilities & Equity Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 flex justify-between items-center">
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-neutral-200 uppercase tracking-wide">TOTAL LIABILITIES & EQUITY</span>
            <span className="text-base font-black text-slate-900 dark:text-white">{fmt(balanceSheet.totalLiabAndEquity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
