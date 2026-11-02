import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Table } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { exportToCSV } from '../utils/exportUtils';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  DollarSign,
  Plus,
  RefreshCw
} from 'lucide-react';

export const TransactionsLedger = () => {
  const { data, recordExpenseEntry, refreshData, isSyncing } = useApp();
  const [filterFlow, setFilterFlow] = useState('ALL'); // 'ALL', 'IN', 'OUT'
  const [filterType, setFilterType] = useState('ALL');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

  // New Expense Form
  const [expCategory, setExpCategory] = useState('Kitchen Utilities');
  const [expAmount, setExpAmount] = useState('');
  const [expPaymentMethod, setExpPaymentMethod] = useState('Cash');
  const [expDescription, setExpDescription] = useState('');
  const expRecordedBy = 'Manager';

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => `${currency} ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const transactions = data?.transactions || [];

  // Filtered transactions
  const filtered = transactions.filter(t => {
    if (filterFlow !== 'ALL' && t.flow !== filterFlow) return false;
    if (filterType !== 'ALL' && t.type !== filterType) return false;
    return true;
  });

  const totalIn = transactions.filter(t => t.flow === 'IN').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOut = transactions.filter(t => t.flow === 'OUT').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netCashFlow = totalIn - totalOut;

  const handleExportCSV = () => {
    const rows = filtered.map(t => ({
      Transaction_ID: t.id,
      Date: t.date,
      Flow: t.flow,
      Type: t.type,
      Reference: t.referenceId,
      Party: t.partyName,
      Category: t.category,
      Payment_Method: t.paymentMethod,
      Amount: t.amount,
      Status: t.status,
      Notes: t.notes
    }));
    exportToCSV(rows, `Boxy_Transactions_${new Date().toISOString().split('T')[0]}`);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) return;

    await recordExpenseEntry({
      category: expCategory,
      amount: Number(expAmount),
      paymentMethod: expPaymentMethod,
      description: expDescription,
      recordedBy: expRecordedBy
    });

    setExpenseModalOpen(false);
    setExpAmount('');
    setExpDescription('');
  };

  const columns = [
    {
      header: 'Flow & Reference',
      accessor: 'referenceId',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
            r.flow === 'IN' 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
          }`}>
            {r.flow === 'IN' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
          </div>
          <div>
            <span className="font-extrabold text-sm text-slate-900 dark:text-white block">{r.reference || r.referenceId || r.id}</span>
            <span className="text-[11px] text-slate-400 font-mono">{r.id}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Date & Time',
      accessor: 'date',
      render: (r) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
          {new Date(r.date).toLocaleDateString('en-GB')} {new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )
    },
    {
      header: 'Party / Description',
      accessor: 'partyName',
      render: (r) => (
        <div>
          <span className="font-bold text-sm text-slate-900 dark:text-white block">{r.partyName || 'Walk-in'}</span>
          <span className="text-xs text-slate-400">{r.notes || r.category}</span>
        </div>
      )
    },
    {
      header: 'Type',
      accessor: 'type',
      render: (r) => (
        <Badge variant={
          r.type === 'Sale' ? 'success' :
          r.type === 'Purchase' ? 'warning' :
          r.type === 'Expense' ? 'danger' : 'default'
        }>
          {r.type}
        </Badge>
      )
    },
    {
      header: 'Method',
      accessor: 'paymentMethod',
      render: (r) => <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{r.paymentMethod || 'Cash'}</span>
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (r) => (
        <span className={`font-black text-sm ${r.flow === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {r.flow === 'IN' ? '+' : '-'}{fmt(r.amount)}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Transactions Ledger</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time cash flow log synced directly to your Google Sheet's <strong>Transactions</strong> tab
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => refreshData()}
            variant="outline"
            size="sm"
            icon={RefreshCw}
            isLoading={isSyncing}
          >
            Sync Now
          </Button>
          <Button
            onClick={() => setExpenseModalOpen(true)}
            variant="secondary"
            size="sm"
            icon={Plus}
          >
            Record Expense
          </Button>
          <Button
            onClick={handleExportCSV}
            variant="success"
            size="sm"
            icon={Download}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Cash Flow Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Total Money In (Sales)</p>
            <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{fmt(totalIn)}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Total Money Out (Costs)</p>
            <h3 className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{fmt(totalOut)}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Net Cash Flow</p>
            <h3 className={`text-xl sm:text-2xl font-black mt-1 ${netCashFlow >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
              {fmt(netCashFlow)}
            </h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {['ALL', 'IN', 'OUT'].map(flow => (
            <button
              key={flow}
              onClick={() => setFilterFlow(flow)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterFlow === flow
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {flow === 'ALL' ? 'All Movements' : flow === 'IN' ? '↓ Money In (+)' : '↑ Money Out (-)'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="Sale">Sales</option>
            <option value="Purchase">Purchases</option>
            <option value="Expense">Expenses</option>
            <option value="Customer Settlement">Customer Payments</option>
            <option value="Supplier Settlement">Supplier Payments</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <Table
        columns={columns}
        data={filtered}
        searchPlaceholder="Search by reference, party, notes..."
        emptyMessage="No transactions recorded yet."
      />

      {/* Record Expense Modal */}
      <Modal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title="Record Kitchen Expense"
        subtitle="Log operational overheads (Gas, Electricity, Packaging, Wages)"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Expense Category *</label>
            <select
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              <option value="Kitchen Utilities">Kitchen Utilities (Electricity, Gas, Water)</option>
              <option value="Packaging & Disposables">Packaging & Disposables</option>
              <option value="Staff Salaries & Wages">Staff Salaries & Wages</option>
              <option value="Maintenance & Cleaning">Maintenance & Cleaning</option>
              <option value="Marketing & Delivery">Marketing & Delivery Commissions</option>
              <option value="Miscellaneous">Miscellaneous Overhead</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Amount ({currency}) *</label>
              <input
                type="number"
                step="any"
                required
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="500.00"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
              <select
                value={expPaymentMethod}
                onChange={(e) => setExpPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="Cash">Cash</option>
                <option value="UPI / Online">UPI / Online</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description / Notes</label>
            <input
              type="text"
              value={expDescription}
              onChange={(e) => setExpDescription(e.target.value)}
              placeholder="e.g. 2 LPG Commercial Gas Cylinders refilled"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="ghost" onClick={() => setExpenseModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Save & Log Expense</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
