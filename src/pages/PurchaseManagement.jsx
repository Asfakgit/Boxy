import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Truck, Plus, Trash2, Calendar, Building2, Package } from 'lucide-react';

export const PurchaseManagement = () => {
  const { data, recordPurchaseEntry, deleteItem, isLoading } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [materialNumber, setMaterialNumber] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [paymentMethod] = useState('Bank Transfer');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  // Items to restock
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [selectedRmId, setSelectedRmId] = useState('');
  const [rmQty, setRmQty] = useState('');
  const [rmPrice, setRmPrice] = useState('');

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => `${currency} ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const suppliers = data?.suppliers || [];
  const rawMaterials = data?.rawMaterials || [];
  const products = data?.products || [];
  const purchases = data?.purchases || [];

  const allStockItems = useMemo(() => {
    const list = [];
    (data?.rawMaterials || []).forEach(rm => {
      list.push({ id: rm.id, name: rm.name, unit: rm.unit || 'kg', costPrice: rm.costPrice || 0, type: 'raw' });
    });
    (data?.products || []).forEach(p => {
      list.push({ id: p.code, name: p.name, unit: p.unit || 'portion', costPrice: p.costPrice || 0, type: 'product' });
    });
    return list;
  }, [data?.rawMaterials, data?.products]);

  const handleAddItemToPurchase = () => {
    if (!selectedRmId || !rmQty || Number(rmQty) <= 0) return;
    const item = allStockItems.find(m => String(m.id) === String(selectedRmId));
    if (!item) return;

    const unitPrice = Number(rmPrice || item.costPrice || 0);
    const itemTotal = unitPrice * Number(rmQty);

    const newItem = {
      rawMaterialId: item.id,
      rawMaterialName: item.name,
      quantity: Number(rmQty),
      unitPrice: unitPrice,
      totalPrice: itemTotal
    };

    const updated = [...purchaseItems, newItem];
    setPurchaseItems(updated);

    // Auto update totalAmount
    const newTotal = updated.reduce((s, i) => s + i.totalPrice, 0);
    setTotalAmount(String(newTotal));

    setSelectedRmId('');
    setRmQty('');
    setRmPrice('');
  };

  const handleRemovePurchaseItem = (idx) => {
    const updated = purchaseItems.filter((_, i) => i !== idx);
    setPurchaseItems(updated);
    const newTotal = updated.reduce((s, i) => s + i.totalPrice, 0);
    setTotalAmount(String(newTotal));
  };

  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    if (!supplierId || !totalAmount) {
      alert('Please select a supplier and enter the total amount.');
      return;
    }

    const supObj = suppliers.find(s => String(s.id) === String(supplierId));

    const payload = {
      date,
      materialNumber: materialNumber || 'PUR-' + Math.floor(Math.random() * 9000 + 1000),
      supplierId,
      supplierName: supObj ? supObj.name : 'General Supplier',
      totalAmount: Number(totalAmount),
      amountPaid: paymentStatus === 'Paid' ? Number(totalAmount) : Number(amountPaid || 0),
      paymentStatus,
      paymentMethod,
      notes,
      items: purchaseItems
    };

    await recordPurchaseEntry(payload);
    setModalOpen(false);
    setTotalAmount('');
    setPurchaseItems([]);
    setNotes('');
  };

  const columns = [
    {
      header: 'Purchase # & Date',
      accessor: 'materialNumber',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h5 className="font-bold text-sm text-slate-900 dark:text-white">{r.materialNumber}</h5>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{r.date}</span>
            </p>
          </div>
        </div>
      )
    },
    {
      header: 'Vendor / Supplier',
      accessor: 'supplierName',
      render: (r) => (
        <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 text-sm">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span>{r.supplierName}</span>
        </div>
      )
    },
    {
      header: 'Invoice Cost',
      accessor: 'totalAmount',
      render: (r) => <span className="font-black text-sm text-slate-900 dark:text-white">{fmt(r.totalAmount)}</span>
    },
    {
      header: 'Payment Status',
      accessor: 'paymentStatus',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Badge variant={r.paymentStatus === 'Paid' ? 'success' : r.paymentStatus === 'Partial' ? 'warning' : 'danger'}>
            {r.paymentStatus}
          </Badge>
          <span className="text-xs text-slate-400">({r.paymentMethod})</span>
        </div>
      )
    },
    {
      header: 'Notes',
      accessor: 'notes',
      render: (r) => <span className="text-xs text-slate-500">{r.notes || '—'}</span>
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-rose-500 hover:text-rose-600"
          onClick={() => {
            if (confirm(`Delete purchase record #${r.materialNumber}?`)) deleteItem('Purchases', r.id, 'Purchase');
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Purchases & Restocking</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Record supplier orders and automatically replenish kitchen raw material inventory
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} variant="primary" icon={Plus}>
          Record New Purchase
        </Button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={purchases}
        searchPlaceholder="Search purchases by vendor, invoice #..."
        emptyMessage="No purchases recorded yet. Restock kitchen inventory above!"
      />

      {/* Record Purchase Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Record Supplier Purchase"
          subtitle="Add raw materials into inventory and track vendor payables"
        >
          <form onSubmit={handleSubmitPurchase} className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Supplier / Vendor *</label>
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                >
                  <option value="">Select Vendor...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Due: {fmt(s.outstandingBalance)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase / Invoice #</label>
                <input
                  type="text"
                  value={materialNumber}
                  onChange={(e) => setMaterialNumber(e.target.value)}
                  placeholder="Auto-generated"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            {/* Restock Inventory Items Sub-Form */}
            {allStockItems.length > 0 && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Restock Inventory Items (Optional)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5">
                    <select
                      value={selectedRmId}
                      onChange={(e) => {
                        setSelectedRmId(e.target.value);
                        const found = allStockItems.find(m => String(m.id) === String(e.target.value));
                        if (found) setRmPrice(String(found.costPrice || ''));
                      }}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                    >
                      <option value="">Select Item to Restock...</option>
                      {rawMaterials.length > 0 && (
                        <optgroup label="Kitchen Raw Materials">
                          {rawMaterials.map(rm => (
                            <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>
                          ))}
                        </optgroup>
                      )}
                      {products.length > 0 && (
                        <optgroup label="Menu Items / Products">
                          {products.map(p => (
                            <option key={p.code} value={p.code}>{p.name} ({p.unit || 'portion'})</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="number"
                      step="any"
                      placeholder="Qty"
                      value={rmQty}
                      onChange={(e) => setRmQty(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="number"
                      step="any"
                      placeholder={`Unit Price (${currency})`}
                      value={rmPrice}
                      onChange={(e) => setRmPrice(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={handleAddItemToPurchase}
                      className="w-full h-8"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {purchaseItems.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {purchaseItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-white dark:bg-slate-900 rounded-lg border">
                        <span>{item.quantity}x {item.rawMaterialName} (@ {fmt(item.unitPrice)})</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{fmt(item.totalPrice)}</span>
                          <button type="button" onClick={() => handleRemovePurchaseItem(idx)} className="text-rose-500">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Total Bill Cost ({currency}) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="2500.00"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                >
                  <option value="Paid">Fully Paid</option>
                  <option value="Partial">Partial Payment</option>
                  <option value="Due">Unpaid / On Credit</option>
                </select>
              </div>
            </div>

            {paymentStatus === 'Partial' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Amount Paid Now ({currency})</label>
                <input
                  type="number"
                  step="any"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="1000.00"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Invoice Ref</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Weekly poultry supply from Al-Kabeer"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isLoading}>Save & Restock</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
