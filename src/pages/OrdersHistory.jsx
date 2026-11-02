import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import {
  Printer,
  Share2,
  Receipt,
  Calendar,
  User,
  Download,
  Eye,
  CloudUpload,
  ExternalLink,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { exportToCSV, prepareSalesDataForCSV } from '../utils/exportUtils';
import { printOrderReceipt, formatWhatsAppReceipt } from '../utils/receiptPrinter';
import { DEFAULT_SHEET_URL, api } from '../services/apiService';

export const OrdersHistory = () => {
  const { data, showToast } = useApp();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [filterPayment, setFilterPayment] = useState('ALL');
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => `${currency} ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const sales = data?.sales || [];
  const filteredSales = filterPayment === 'ALL' ? sales : sales.filter(s => s.paymentMethod === filterPayment);

  const totalSalesRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const totalGrossProfit = sales.reduce((sum, s) => sum + Number(s.grossProfit || 0), 0);
  const avgOrderValue = sales.length > 0 ? totalSalesRevenue / sales.length : 0;

  const handleOpenReceipt = (order) => {
    setSelectedOrder(order);
    setReceiptModalOpen(true);
  };

  // 1. Export Clean CSV of Invoices
  const handleExportCSV = () => {
    const formatted = prepareSalesDataForCSV(filteredSales);
    exportToCSV(formatted, `Boxy_Orders_Export_${new Date().toISOString().split('T')[0]}`);
  };

  // 2. Synchronize All Invoices directly to Google Sheets Sales & Transactions Tabs
  const handleSyncToGoogleSheet = async () => {
    if (sales.length === 0) {
      showToast('No orders recorded to sync.', 'info');
      return;
    }

    setIsSyncingSheets(true);
    try {
      let count = 0;
      for (const sale of sales) {
        await api.recordSale(sale);
        count++;
      }
      showToast(`Successfully stored and synchronized ${count} invoices in Google Sheet!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error syncing invoices to Google Sheet: ' + err.message, 'error');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const columns = [
    {
      header: 'Invoice #',
      accessor: 'invoiceNumber',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
            <Receipt className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">{r.invoiceNumber}</span>
        </div>
      )
    },
    {
      header: 'Date & Time',
      accessor: 'date',
      render: (r) => (
        <div className="text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200 block">
            {r.date ? new Date(r.date).toLocaleDateString('en-GB') : '—'}
          </span>
          <span className="text-slate-400 text-[10px]">
            {r.date ? new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
      )
    },
    {
      header: 'Customer',
      accessor: 'customerName',
      render: (r) => (
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span>{r.customerName || 'Walk-in Customer'}</span>
        </div>
      )
    },
    {
      header: 'Items Ordered',
      accessor: 'itemsSummary',
      render: (r) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-xs block" title={r.itemsSummary}>
          {r.itemsSummary || (r.items && r.items.length > 0 ? r.items.map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ') : 'POS Sale')}
        </span>
      )
    },
    {
      header: 'Gross Profit',
      accessor: 'grossProfit',
      render: (r) => <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{fmt(r.grossProfit)}</span>
    },
    {
      header: 'Total Paid',
      accessor: 'totalAmount',
      render: (r) => <span className="font-black text-sm text-slate-900 dark:text-white">{fmt(r.totalAmount)}</span>
    },
    {
      header: 'Method',
      accessor: 'paymentMethod',
      render: (r) => <Badge variant={r.paymentMethod === 'Credit' ? 'warning' : 'default'}>{r.paymentMethod || 'Cash'}</Badge>
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenReceipt(r)}
            className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 p-1.5"
            title="View & Print Receipt"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => printOrderReceipt(r, data?.settings)}
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5"
            title="Print Thermal / PDF Receipt"
          >
            <Printer className="w-4 h-4" />
          </Button>
          <a
            href={formatWhatsAppReceipt(r, data?.settings)}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
            title="Share Digital Bill on WhatsApp"
          >
            <Share2 className="w-4 h-4" />
          </a>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header with Cloud Sync, Open Sheet, and Export CSV */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Orders & Invoices History</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Complete audit log of all completed POS checkouts, stored directly in Google Sheets
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Link to Google Sheet Database */}
          <a
            href={DEFAULT_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            <span>Open Google Sheet</span>
          </a>

          {/* Sync All Invoices to Google Sheet */}
          <Button
            onClick={handleSyncToGoogleSheet}
            isLoading={isSyncingSheets}
            variant="outline"
            icon={CloudUpload}
            size="sm"
            className="border-indigo-200 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          >
            {isSyncingSheets ? 'Storing...' : 'Store in Google Sheet'}
          </Button>

          {/* Export to CSV */}
          <Button
            onClick={handleExportCSV}
            variant="success"
            icon={Download}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Export Orders to CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Total Invoiced</p>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{sales.length} Orders</h3>
        </div>
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Sales Volume</p>
          <h3 className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{fmt(totalSalesRevenue)}</h3>
        </div>
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Gross Profit</p>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{fmt(totalGrossProfit)}</h3>
        </div>
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Avg Order</p>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mt-1">{fmt(avgOrderValue)}</h3>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none py-0.5">
          <span className="text-xs font-bold text-slate-400 px-1 sm:px-2 shrink-0">Payment:</span>
          {['ALL', 'Cash', 'UPI / Online', 'Credit'].map(method => (
            <button
              key={method}
              onClick={() => setFilterPayment(method)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                filterPayment === method
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <Table
        columns={columns}
        data={filteredSales}
        searchPlaceholder="Search invoices, customer names..."
        emptyMessage="No sales recorded yet."
      />

      {/* Receipt Modal */}
      {receiptModalOpen && selectedOrder && (
        <Modal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          title={`Order Receipt — #${selectedOrder.invoiceNumber}`}
        >
          <div className="space-y-4 pt-2">
            <div className="p-5 bg-white text-slate-900 border border-slate-200 rounded-2xl font-mono text-xs shadow-inner space-y-3">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3 flex flex-col items-center">
                <img src={data?.settings?.logo || '/logo.jpg'} alt="Logo" className="w-12 h-12 rounded-xl object-cover mb-2 ring-1 ring-amber-400/40 shadow-xs" />
                <h3 className="font-black text-sm tracking-wider uppercase">{data?.settings?.companyName || 'BOXY CLOUD KITCHEN'}</h3>
                <p className="text-[10px] text-slate-500">{data?.settings?.tagline || 'Est. 2022'}</p>
                <p className="text-[10px] text-slate-500">Invoice: #{selectedOrder.invoiceNumber}</p>
                <p className="text-[10px] text-slate-500">Date: {new Date(selectedOrder.date).toLocaleString('en-GB')}</p>
                <p className="text-[10px] text-slate-500">Client: {selectedOrder.customerName || 'Walk-in'}</p>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-200">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Price</span>
                </div>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="truncate max-w-[150px]">{item.productName || item.name}</span>
                      <span className="text-slate-500">{item.quantity}</span>
                      <span className="font-bold">{fmt((Number(item.unitPrice || item.price || 0)) * (Number(item.quantity) || 1))}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-600 text-xs py-1">
                    {selectedOrder.itemsSummary || 'Standard Order'}
                  </div>
                )}
              </div>

              <div className="space-y-1 pt-1 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{fmt(selectedOrder.subtotal || selectedOrder.totalAmount)}</span>
                </div>
                {Number(selectedOrder.discount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-{fmt(selectedOrder.discount)}</span>
                  </div>
                )}
                {Number(selectedOrder.taxAmount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax / GST:</span>
                    <span>+{fmt(selectedOrder.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Paid ({selectedOrder.paymentMethod}):</span>
                  <span>{fmt(selectedOrder.totalAmount)}</span>
                </div>
              </div>

              <div className="text-center pt-1 text-[10px] text-slate-500">
                <p>{data?.settings?.invoiceFooter || 'Thank you for ordering with Boxy Cloud Kitchen!'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                icon={Printer}
                onClick={() => printOrderReceipt(selectedOrder, data?.settings)}
              >
                Print / Save PDF
              </Button>
              <a
                href={formatWhatsAppReceipt(selectedOrder, data?.settings)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp Share</span>
              </a>
              <Button size="sm" variant="secondary" onClick={() => setReceiptModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
