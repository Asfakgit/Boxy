import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Building2, Plus, Edit2, Trash2, Phone, MapPin, DollarSign, FileText } from 'lucide-react';
import { formatMoney } from '../utils/format';
import { useCollections } from '../hooks/useCollections';

export const SupplierManagement = () => {
  const navigate = useNavigate();
  const { data, saveItem, deleteItem, recordSupplierPayment, showConfirmDialog, isLoading } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [selectedSupForPay, setSelectedSupForPay] = useState(null);

  // Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [outstandingBalance, setOutstandingBalance] = useState('0');
  const [payAmount, setPayAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => formatMoney(val, currency);

  const { suppliers } = useCollections();
  const totalPayables = suppliers.reduce((sum, s) => sum + Number(s.outstandingBalance || 0), 0);

  const openAddModal = (sup = null) => {
    if (sup) {
      setEditingSup(sup);
      setName(sup.name || '');
      setPhone(sup.phone || '');
      setAddress(sup.address || '');
      setOutstandingBalance(String(sup.outstandingBalance || '0'));
    } else {
      setEditingSup(null);
      setName('');
      setPhone('');
      setAddress('');
      setOutstandingBalance('0');
    }
    setModalOpen(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      ...(editingSup || {}),
      name,
      phone,
      address,
      outstandingBalance: Number(outstandingBalance || 0),
      totalPurchases: editingSup ? Number(editingSup.totalPurchases || 0) : 0
    };

    const executeSave = async () => {
      await saveItem('Suppliers', payload, 'Supplier');
      setModalOpen(false);
    };

    if (editingSup) {
      showConfirmDialog({
        title: 'Update Supplier',
        itemName: name,
        message: `Are you sure you want to save changes to supplier "${name}"?`,
        type: 'update',
        confirmText: 'Yes, Save Changes',
        onConfirm: executeSave
      });
    } else {
      await executeSave();
    }
  };

  const openPayModal = (sup) => {
    setSelectedSupForPay(sup);
    setPayAmount(String(sup.outstandingBalance || 0));
    setPayModalOpen(true);
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedSupForPay || !payAmount) return;
    await recordSupplierPayment(selectedSupForPay.id, Number(payAmount), paymentMethod);
    setPayModalOpen(false);
  };

  const columns = [
    {
      header: 'Supplier / Vendor',
      accessor: 'name',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h5 className="font-bold text-sm text-slate-900 dark:text-white">{r.name}</h5>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>{r.phone || 'No phone'}</span>
            </p>
          </div>
        </div>
      )
    },
    {
      header: 'Address / Warehouse',
      accessor: 'address',
      render: (r) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>{r.address || '—'}</span>
        </span>
      )
    },
    {
      header: 'Total Purchased',
      accessor: 'totalPurchases',
      render: (r) => <span className="text-xs font-semibold text-slate-500">{fmt(r.totalPurchases)}</span>
    },
    {
      header: 'Payable Due',
      accessor: 'outstandingBalance',
      render: (r) => {
        const bal = Number(r.outstandingBalance || 0);
        return (
          <span className={`font-black text-sm ${bal > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {fmt(bal)}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {Number(r.outstandingBalance || 0) > 0 && (
            <Button size="sm" variant="outline" onClick={() => openPayModal(r)} className="text-xs h-7 px-2">
              Pay Bill
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/reports?tab=supplier-ledger&supplierId=${r.id}`)}
            className="text-xs h-7 px-2 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            title="View Vendor Ledger & Statement"
          >
            <FileText className="w-3.5 h-3.5 mr-1" />
            Ledger
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openAddModal(r)}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-500 hover:text-rose-600"
            onClick={() => {
              showConfirmDialog({
                title: 'Delete Supplier',
                itemName: r.name,
                message: `Are you sure you want to permanently delete supplier "${r.name}"? This cannot be undone.`,
                type: 'delete',
                confirmText: 'Yes, Delete',
                onConfirm: () => deleteItem('Suppliers', r.id, 'Supplier')
              });
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Supplier & Vendor Directory</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage your kitchen raw material vendors, wholesale suppliers, and pending bills
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/reports?tab=supplier-ledger')}
            variant="outline"
            icon={FileText}
            className="text-xs"
          >
            Vendor Ledgers & Statements
          </Button>
          <Button onClick={() => openAddModal()} variant="primary" icon={Plus}>
            Add New Supplier
          </Button>
        </div>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registered Suppliers</p>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">{suppliers.length} Vendors</h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Payables Due</p>
            <h3 className="text-lg sm:text-xl font-black text-amber-600 mt-0.5">{fmt(totalPayables)}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <Table
        columns={columns}
        data={suppliers}
        searchPlaceholder="Search suppliers by name, phone..."
        emptyMessage="No suppliers registered yet. Add your first vendor above!"
      />

      {/* Add / Edit Supplier Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingSup ? 'Edit Supplier Profile' : 'Register New Supplier'}
          subtitle="Maintain vendor contact info and payment balances"
        >
          <form onSubmit={handleSaveSupplier} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Supplier / Company Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Metro Wholesale Foods"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 91234 56789"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Opening Payable ({currency})</label>
                <input
                  type="number"
                  step="any"
                  value={outstandingBalance}
                  onChange={(e) => setOutstandingBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Warehouse / Office Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Sector 4, Industrial Area"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isLoading}>Save Supplier</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Pay Supplier Modal */}
      {payModalOpen && selectedSupForPay && (
        <Modal
          isOpen={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          title={`Pay Supplier Bill`}
          subtitle={`${selectedSupForPay.name} • Pending Payable: ${fmt(selectedSupForPay.outstandingBalance)}`}
        >
          <form onSubmit={handlePaySubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Amount ({currency}) *</label>
              <input
                type="number"
                step="any"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              >
                <option value="Bank Transfer">Bank Transfer / NEFT</option>
                <option value="UPI / Online">UPI / Online</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setPayModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isLoading}>Confirm Payment & Log</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
