import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { exportToCSV, prepareTransactionDataForExport } from '../utils/exportUtils';
import { Download, TrendingUp, Archive, ArrowLeftRight } from 'lucide-react';

export const ReportingAnalytics = () => {
  const { data } = useApp();
  const [reportType, setReportType] = useState('sales'); // 'sales', 'purchases', 'transactions'

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => `${currency} ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const sales = data?.sales || [];
  const purchases = data?.purchases || [];
  const transactions = data?.transactions || [];

  const handleExportCSV = () => {
    if (reportType === 'sales') {
      const formatted = prepareTransactionDataForExport(sales);
      exportToCSV(formatted, `Boxy_Sales_Report_${new Date().toISOString().split('T')[0]}`);
    } else if (reportType === 'purchases') {
      const formatted = purchases.map(p => ({
        Purchase_ID: p.id,
        Date: p.date,
        Material_Number: p.materialNumber,
        Supplier: p.supplierName,
        Total_Amount: p.totalAmount,
        Amount_Paid: p.amountPaid,
        Payment_Status: p.paymentStatus,
        Payment_Method: p.paymentMethod,
        Notes: p.notes
      }));
      exportToCSV(formatted, `Boxy_Purchases_Report_${new Date().toISOString().split('T')[0]}`);
    } else if (reportType === 'transactions') {
      const formatted = transactions.map(t => ({
        ID: t.id,
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
      exportToCSV(formatted, `Boxy_Transactions_Report_${new Date().toISOString().split('T')[0]}`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Reports & Financial Analytics</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Exportable CSV & Excel spreadsheets for accounting and profitability analysis
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="success" icon={Download} className="shadow-md shadow-emerald-500/20">
          Export Active Report to CSV
        </Button>
      </div>

      {/* Report Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setReportType('sales')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
            reportType === 'sales'
              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-2 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Report 1</p>
            <h4 className="font-extrabold text-base text-slate-900 dark:text-white mt-0.5">Sales & Revenue</h4>
            <p className="text-[11px] text-slate-500 mt-1">{sales.length} Invoiced Orders</p>
          </div>
          <TrendingUp className={`w-6 h-6 ${reportType === 'sales' ? 'text-indigo-600' : 'text-slate-400'}`} />
        </div>

        <div
          onClick={() => setReportType('purchases')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
            reportType === 'purchases'
              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-2 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Report 2</p>
            <h4 className="font-extrabold text-base text-slate-900 dark:text-white mt-0.5">Purchases & Restocking</h4>
            <p className="text-[11px] text-slate-500 mt-1">{purchases.length} Purchase Invoices</p>
          </div>
          <Archive className={`w-6 h-6 ${reportType === 'purchases' ? 'text-indigo-600' : 'text-slate-400'}`} />
        </div>

        <div
          onClick={() => setReportType('transactions')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
            reportType === 'transactions'
              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-2 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Report 3</p>
            <h4 className="font-extrabold text-base text-slate-900 dark:text-white mt-0.5">Transactions Cash Flow</h4>
            <p className="text-[11px] text-slate-500 mt-1">{transactions.length} Total Cash Movements</p>
          </div>
          <ArrowLeftRight className={`w-6 h-6 ${reportType === 'transactions' ? 'text-indigo-600' : 'text-slate-400'}`} />
        </div>
      </div>

      {/* Render Active Table */}
      {reportType === 'sales' && (
        <Card title="Sales & Revenue Ledger" subtitle="Downloadable transaction history with customer names and profit margins">
          <Table
            columns={[
              { header: 'Invoice #', accessor: 'invoiceNumber', render: (r) => <span className="font-bold text-indigo-600 dark:text-indigo-400">{r.invoiceNumber}</span> },
              { header: 'Date', accessor: 'date', render: (r) => new Date(r.date).toLocaleDateString('en-GB') },
              { header: 'Customer', accessor: 'customerName', render: (r) => r.customerName || 'Walk-in Customer' },
              { header: 'Payment Method', accessor: 'paymentMethod', render: (r) => r.paymentMethod },
              { header: 'Gross Profit', accessor: 'grossProfit', render: (r) => <span className="text-emerald-600 font-bold">{fmt(r.grossProfit)}</span> },
              { header: 'Total Paid', accessor: 'totalAmount', render: (r) => <span className="font-black">{fmt(r.totalAmount)}</span> },
            ]}
            data={sales}
            emptyMessage="No sales recorded."
          />
        </Card>
      )}

      {reportType === 'purchases' && (
        <Card title="Purchases & Vendor Cost Ledger" subtitle="Record of all raw material restocking invoices">
          <Table
            columns={[
              { header: 'Purchase #', accessor: 'materialNumber', render: (r) => <span className="font-bold">{r.materialNumber}</span> },
              { header: 'Date', accessor: 'date', render: (r) => r.date },
              { header: 'Supplier', accessor: 'supplierName', render: (r) => r.supplierName },
              { header: 'Status', accessor: 'paymentStatus', render: (r) => r.paymentStatus },
              { header: 'Method', accessor: 'paymentMethod', render: (r) => r.paymentMethod },
              { header: 'Total Cost', accessor: 'totalAmount', render: (r) => <span className="font-black text-rose-600">{fmt(r.totalAmount)}</span> },
            ]}
            data={purchases}
            emptyMessage="No purchases recorded."
          />
        </Card>
      )}

      {reportType === 'transactions' && (
        <Card title="Cash Flow Master Transactions Ledger" subtitle="Audit trail directly mapping to the Transactions Google Sheet tab">
          <Table
            columns={[
              { header: 'ID', accessor: 'id', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
              { header: 'Date', accessor: 'date', render: (r) => new Date(r.date).toLocaleDateString('en-GB') },
              { header: 'Flow', accessor: 'flow', render: (r) => (
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${r.flow === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {r.flow}
                </span>
              )},
              { header: 'Type', accessor: 'type', render: (r) => r.type },
              { header: 'Reference', accessor: 'referenceId', render: (r) => r.referenceId },
              { header: 'Party', accessor: 'partyName', render: (r) => r.partyName },
              { header: 'Amount', accessor: 'amount', render: (r) => (
                <span className={`font-black ${r.flow === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {r.flow === 'IN' ? '+' : '-'}{fmt(r.amount)}
                </span>
              )}
            ]}
            data={transactions}
            emptyMessage="No transactions logged."
          />
        </Card>
      )}
    </div>
  );
};
