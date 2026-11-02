import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Printer, Share2, Receipt, Calendar, User, Download, Eye } from 'lucide-react';
import { exportToCSV, prepareTransactionDataForExport } from '../utils/exportUtils';

export const OrdersHistory = () => {
  const { data } = useApp();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [filterPayment, setFilterPayment] = useState('ALL');

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

  const handleExportCSV = () => {
    const formatted = prepareTransactionDataForExport(filteredSales);
    exportToCSV(formatted, `Boxy_Orders_Export_${new Date().toISOString().split('T')[0]}`);
  };

  const getWhatsAppShareUrl = () => {
    if (!selectedOrder) return '#';
    const itemsText = (selectedOrder.items && selectedOrder.items.length > 0)
      ? selectedOrder.items.map(i => `${i.quantity}x ${i.productName || i.name} (${fmt(i.unitPrice * i.quantity)})`).join('%0a')
      : (selectedOrder.itemsSummary || 'Order details');
    const text = `*Boxy Cloud Kitchen — Receipt*%0a` +
      `Invoice: #${selectedOrder.invoiceNumber}%0a` +
      `Date: ${new Date(selectedOrder.date).toLocaleDateString('en-GB')}%0a` +
      `Customer: ${selectedOrder.customerName}%0a%0a` +
      `*Items Ordered:*%0a${itemsText}%0a%0a` +
      `Subtotal: ${fmt(selectedOrder.subtotal)}%0a` +
      (selectedOrder.discount > 0 ? `Discount: -${fmt(selectedOrder.discount)}%0a` : '') +
      `*Total Paid (${selectedOrder.paymentMethod}): ${fmt(selectedOrder.totalAmount)}*%0a%0a` +
      `Thank you for ordering with Boxy Cloud Kitchen!`;
    return `https://wa.me/?text=${text}`;
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
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{new Date(r.date).toLocaleDateString('en-GB')} {new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
      header: 'Receipt',
      accessor: 'id',
      render: (r) => (
        <Button size="sm" variant="outline" icon={Eye} onClick={() => handleOpenReceipt(r)}>
          View
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Orders & Invoices History</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Complete audit log of all completed POS checkouts and B2B invoices</p>
        </div>
        <Button onClick={handleExportCSV} variant="success" icon={Download} size="sm">
          Export Orders to CSV
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400">Total Orders Invoiced</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{sales.length} Orders</h3>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400">Total Sales Volume</p>
          <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{fmt(totalSalesRevenue)}</h3>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400">Total Gross Profit</p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{fmt(totalGrossProfit)}</h3>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400">Avg Order Value</p>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{fmt(avgOrderValue)}</h3>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 px-2">Payment Filter:</span>
          {['ALL', 'Cash', 'UPI / Online', 'Credit'].map(method => (
            <button
              key={method}
              onClick={() => setFilterPayment(method)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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

      {/* Receipt Preview Modal */}
      {receiptModalOpen && selectedOrder && (
        <Modal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          title={`Thermal Receipt #${selectedOrder.invoiceNumber}`}
        >
          <div className="space-y-4 pt-2">
            <div id="printable-receipt" className="p-5 bg-white text-slate-900 border border-slate-200 rounded-2xl font-mono text-xs shadow-inner space-y-3">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3 flex flex-col items-center">
                <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-xl object-cover mb-2 ring-1 ring-amber-400/40 shadow-xs" />
                <h3 className="font-black text-sm tracking-wider uppercase">{data?.settings?.companyName || 'BOXY CLOUD KITCHEN'}</h3>
                <p className="text-[10px] text-slate-500">Invoice: #{selectedOrder.invoiceNumber}</p>
                <p className="text-[10px] text-slate-500">Date: {new Date(selectedOrder.date).toLocaleString('en-GB')}</p>
                <p className="text-[10px] text-slate-500">Client: {selectedOrder.customerName}</p>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-200">
                  <span>Item</span>
                  <span>Qty x Price</span>
                  <span>Amount</span>
                </div>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="truncate max-w-[120px]">{item.productName || item.name}</span>
                      <span className="text-slate-500">{item.quantity} x {fmt(item.unitPrice)}</span>
                      <span className="font-bold">{fmt(item.quantity * item.unitPrice)}</span>
                    </div>
                  ))
                ) : (
                  <div className="py-1 text-slate-700 text-xs">
                    {selectedOrder.itemsSummary || 'Standard Order Items'}
                  </div>
                )}
              </div>

              <div className="space-y-1 pt-1 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{fmt(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-{fmt(selectedOrder.discount)}</span>
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" icon={Printer} onClick={() => window.print()}>
                Print
              </Button>
              <a
                href={getWhatsAppShareUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
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
