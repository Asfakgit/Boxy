import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Users, Plus, Edit2, Trash2, DollarSign, Store, Phone } from 'lucide-react';

export const CustomerManagement = () => {
  const { data, saveItem, deleteItem, recordCustomerSettlement, showConfirmDialog, isLoading } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [editingCust, setEditingCust] = useState(null);
  const [selectedCustForSettle, setSelectedCustForSettle] = useState(null);

  // Form States
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('5000');
  const [customerType, setCustomerType] = useState('Retail Cafe');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => `${currency} ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const customers = data?.customers || [];
  const totalReceivables = customers.reduce((sum, c) => sum + Number(c.outstandingBalance || 0), 0);

  const openAddModal = (cust = null) => {
    if (cust) {
      setEditingCust(cust);
      setName(cust.name || '');
      setShopName(cust.shopName || '');
      setPhone(cust.phone || '');
      setAddress(cust.address || '');
      setCreditLimit(String(cust.creditLimit || '5000'));
      setCustomerType(cust.customerType || 'Retail Cafe');
    } else {
      setEditingCust(null);
      setName('');
      setShopName('');
      setPhone('');
      setAddress('');
      setCreditLimit('5000');
      setCustomerType('Retail Cafe');
    }
    setModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      ...(editingCust || {}),
      name,
      shopName,
      phone,
      address,
      creditLimit: Number(creditLimit),
      customerType,
      outstandingBalance: editingCust ? Number(editingCust.outstandingBalance || 0) : 0,
      totalPurchases: editingCust ? Number(editingCust.totalPurchases || 0) : 0
    };

    const executeSave = async () => {
      await saveItem('Customers', payload, 'Customer');
      setModalOpen(false);
    };

    if (editingCust) {
      showConfirmDialog({
        title: 'Update Customer',
        itemName: name,
        message: `Are you sure you want to save changes to customer "${name}"?`,
        type: 'update',
        confirmText: 'Yes, Save Changes',
        onConfirm: executeSave
      });
    } else {
      await executeSave();
    }
  };

  const openSettleModal = (cust) => {
    setSelectedCustForSettle(cust);
    setSettleAmount(String(cust.outstandingBalance || 0));
    setSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustForSettle || !settleAmount) return;
    await recordCustomerSettlement(selectedCustForSettle.id, Number(settleAmount), settleMethod);
    setSettleModalOpen(false);
  };

  const columns = [
    {
      header: 'Customer / Outlet',
      accessor: 'shopName',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <h5 className="font-bold text-sm text-slate-900 dark:text-white">{r.shopName || r.name}</h5>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>{r.name}</span>
              <span>•</span>
              <Badge variant="default">{r.customerType || 'Retail'}</Badge>
            </p>
          </div>
        </div>
      )
    },
    {
      header: 'Phone / Contact',
      accessor: 'phone',
      render: (r) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          <span>{r.phone || '—'}</span>
        </span>
      )
    },
    {
      header: 'Credit Limit',
      accessor: 'creditLimit',
      render: (r) => <span className="text-xs font-semibold text-slate-500">{fmt(r.creditLimit)}</span>
    },
    {
      header: 'Balance Due',
      accessor: 'outstandingBalance',
      render: (r) => {
        const bal = Number(r.outstandingBalance || 0);
        return (
          <span className={`font-black text-sm ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
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
            <Button size="sm" variant="success" onClick={() => openSettleModal(r)} className="text-xs h-7 px-2">
              Receive
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => openAddModal(r)}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-500 hover:text-rose-600"
            onClick={() => {
              showConfirmDialog({
                title: 'Delete Customer',
                itemName: r.name,
                message: `Are you sure you want to permanently delete customer "${r.name}"? This cannot be undone.`,
                type: 'delete',
                confirmText: 'Yes, Delete',
                onConfirm: () => deleteItem('Customers', r.id, 'Customer')
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
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Customer Directory & B2B Accounts</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage your corporate accounts, retail cafe clients, and credit balances
          </p>
        </div>
        <Button onClick={() => openAddModal()} variant="primary" icon={Plus}>
          Add New Customer
        </Button>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Total Registered Customers</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{customers.length} Accounts</h3>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Total Outstanding Receivables</p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{fmt(totalReceivables)}</h3>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <Table
        columns={columns}
        data={customers}
        searchPlaceholder="Search customers by name, shop, phone..."
        emptyMessage="No customers found. Add your first customer above!"
      />

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingCust ? 'Edit Customer Profile' : 'Register New Customer'}
          subtitle="Maintain customer contact details and credit limits"
        >
          <form onSubmit={handleSaveCustomer} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Person Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Shop / Outlet Name</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Chai & Bites Cafe"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Credit Limit ({currency})</label>
                <input
                  type="number"
                  step="any"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Delivery Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop #12, Commercial Road"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isLoading}>Save Customer</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Receive Payment Settlement Modal */}
      {settleModalOpen && selectedCustForSettle && (
        <Modal
          isOpen={settleModalOpen}
          onClose={() => setSettleModalOpen(false)}
          title={`Receive Customer Payment`}
          subtitle={`${selectedCustForSettle.shopName || selectedCustForSettle.name} • Due: ${fmt(selectedCustForSettle.outstandingBalance)}`}
        >
          <form onSubmit={handleSettleSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Amount ({currency}) *</label>
              <input
                type="number"
                step="any"
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
              <select
                value={settleMethod}
                onChange={(e) => setSettleMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              >
                <option value="Cash">Cash</option>
                <option value="UPI / Online">UPI / Online</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setSettleModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="success" isLoading={isLoading}>Confirm Received & Log</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
