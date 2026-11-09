import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { useNavigate } from 'react-router-dom';
import {
  calculateBusinessFinancials,
  calculatePartnerSummary,
  fmtCurrency
} from '../utils/partnerLabourUtils';
import { exportPartnerStatementPDF } from '../utils/pdfExportUtils';
import {
  Users,
  TrendingUp,
  CreditCard,
  Wallet,
  DollarSign,
  Plus,
  Calendar,
  Percent,
  Download,
  Phone,
  MapPin,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  HardHat,
  ArrowRight,
  Edit2,
  Trash2,
  ExternalLink
} from 'lucide-react';

export const PartnerManagement = () => {
  const { data, savePartner, deletePartner, recordPartnerWithdrawal, showToast, showConfirmDialog } = useApp();
  const navigate = useNavigate();

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => fmtCurrency(val, currency);

  // 1. DATE RANGE FILTER STATE
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const startOfMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  const [startDate, setStartDate] = useState(startOfMonthStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState('this-month');

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

  // 2. FINANCIAL & PARTNER CALCULATIONS
  const financials = useMemo(() => {
    return calculateBusinessFinancials({
      sales: data?.sales || [],
      purchases: data?.purchases || [],
      expenses: data?.expenses || [],
      startDate: activePreset === 'all-time' ? null : startDate,
      endDate: activePreset === 'all-time' ? null : endDate,
      reserveDeduction: Number(data?.settings?.reserveDeduction || 0)
    });
  }, [data?.sales, data?.purchases, data?.expenses, data?.settings?.reserveDeduction, startDate, endDate, activePreset]);

  const partnerSummary = useMemo(() => {
    return calculatePartnerSummary({
      partners: data?.partners || [],
      distributableProfit: financials.distributableProfit,
      partnerWithdrawals: data?.partnerWithdrawals || [],
      startDate: activePreset === 'all-time' ? null : startDate,
      endDate: activePreset === 'all-time' ? null : endDate
    });
  }, [data?.partners, data?.partnerWithdrawals, financials.distributableProfit, startDate, endDate, activePreset]);

  // 3. MODAL STATES
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedPartnerForWithdraw, setSelectedPartnerForWithdraw] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('Cash');
  const [withdrawDate, setWithdrawDate] = useState(todayStr);
  const [withdrawNotes, setWithdrawNotes] = useState('');

  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [partnerForm, setPartnerForm] = useState({
    name: '',
    phone: '',
    address: '',
    joiningDate: todayStr,
    profitShare: '',
    isLabour: false,
    jobRole: 'Kitchen Chef',
    salaryType: 'Monthly',
    salaryAmount: 18000,
    status: 'Active',
    notes: ''
  });

  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState(null);

  // 4. HANDLERS
  const openWithdrawModal = (partner) => {
    setSelectedPartnerForWithdraw(partner);
    setWithdrawAmount('');
    setWithdrawMethod('Cash');
    setWithdrawDate(todayStr);
    setWithdrawNotes('');
    setIsWithdrawModalOpen(true);
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPartnerForWithdraw || !withdrawAmount || Number(withdrawAmount) <= 0) {
      showToast('Please enter a valid withdrawal amount.', 'error');
      return;
    }

    const numAmount = Number(withdrawAmount);
    await recordPartnerWithdrawal({
      partnerId: selectedPartnerForWithdraw.id,
      partnerName: selectedPartnerForWithdraw.name,
      amount: numAmount,
      paymentMethod: withdrawMethod,
      date: withdrawDate,
      notes: withdrawNotes || `Partner withdrawal by ${selectedPartnerForWithdraw.name}`
    });

    setIsWithdrawModalOpen(false);
  };

  const openAddPartnerModal = () => {
    setEditingPartner(null);
    // Suggest share percentage to complete 100%
    const currentTotal = (data?.partners || []).reduce((sum, p) => sum + Number(p.profitShare || 0), 0);
    const suggested = Math.max(0, 100 - currentTotal);

    setPartnerForm({
      name: '',
      phone: '',
      address: '',
      joiningDate: todayStr,
      profitShare: suggested > 0 ? String(suggested) : '',
      isLabour: false,
      jobRole: 'Kitchen Chef',
      salaryType: 'Monthly',
      salaryAmount: 18000,
      status: 'Active',
      notes: ''
    });
    setIsPartnerModalOpen(true);
  };

  const openEditPartnerModal = (partner) => {
    setEditingPartner(partner);
    setPartnerForm({
      name: partner.name || '',
      phone: partner.phone || '',
      address: partner.address || '',
      joiningDate: partner.joiningDate || todayStr,
      profitShare: String(partner.profitShare || ''),
      isLabour: Boolean(partner.isLabour),
      jobRole: partner.jobRole || 'Kitchen Chef',
      salaryType: partner.salaryType || 'Monthly',
      salaryAmount: partner.salaryAmount || 18000,
      status: partner.status || 'Active',
      notes: partner.notes || ''
    });
    setIsPartnerModalOpen(true);
  };

  const handlePartnerSubmit = async (e) => {
    e.preventDefault();
    if (!partnerForm.name.trim()) {
      showToast('Partner name is required.', 'error');
      return;
    }

    const newShare = Number(partnerForm.profitShare || 0);
    const otherPartners = (data?.partners || []).filter(p => !editingPartner || p.id !== editingPartner.id);
    const otherTotal = otherPartners.reduce((sum, p) => sum + Number(p.profitShare || 0), 0);
    const totalWithNew = otherTotal + newShare;

    if (Math.round(totalWithNew) !== 100) {
      showToast(`Total profit-sharing percentage must equal 100%. Current total would be ${totalWithNew}%.`, 'error');
      return;
    }

    await savePartner({
      ...(editingPartner || {}),
      name: partnerForm.name.trim(),
      phone: partnerForm.phone.trim(),
      address: partnerForm.address.trim(),
      joiningDate: partnerForm.joiningDate,
      profitShare: newShare,
      isPartner: true,
      isLabour: partnerForm.isLabour,
      jobRole: partnerForm.jobRole,
      salaryType: partnerForm.salaryType,
      salaryAmount: Number(partnerForm.salaryAmount || 0),
      status: partnerForm.status,
      notes: partnerForm.notes
    });

    setIsPartnerModalOpen(false);
  };

  const handleDeletePartner = (partner) => {
    showConfirmDialog({
      title: `Remove Partner: ${partner.name}?`,
      message: `Are you sure you want to remove ${partner.name}? Note: Profit shares of other partners must be adjusted to total 100%.`,
      type: 'danger',
      confirmText: 'Yes, Remove Partner',
      onConfirm: () => deletePartner(partner.id)
    });
  };

  const openStatementModal = (partner) => {
    setSelectedPartnerForStatement(partner);
    setIsStatementModalOpen(true);
  };

  const handleExportPDF = (partner) => {
    exportPartnerStatementPDF({
      partner,
      financials: partnerSummary,
      withdrawals: partner.withdrawalsList || [],
      dateRange: { startDate, endDate },
      settings: data?.settings || {},
      currency
    });
    showToast(`Statement PDF downloaded for ${partner.name}!`, 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Partner Management</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage equity partners, profit distribution percentages, and drawings
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/labour')}
            icon={HardHat}
            className="text-xs border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300"
          >
            Labour Section
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openAddPartnerModal}
            icon={Plus}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
          >
            Add Partner
          </Button>
        </div>
      </div>

      {/* 2. Date Presets & Range Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <span className="text-xs font-bold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Period:
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
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Partner Financial Dashboard (4 Essential Metric Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Distributable Profit */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Distributable Profit</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {fmt(financials.distributableProfit)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Net profit after all labour wages
            </p>
          </div>
        </div>

        {/* Total Allocated to Partners */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Allocated</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {fmt(partnerSummary.totalAllocatedProfit)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              100% of distributable pool
            </p>
          </div>
        </div>

        {/* Total Partner Withdrawals */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Withdrawals</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-neutral-900 text-rose-600 dark:text-rose-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {fmt(partnerSummary.totalWithdrawals)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Drawings from equity pool
            </p>
          </div>
        </div>

        {/* Remaining Partner Balances */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Remaining Balance</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className={`text-xl sm:text-2xl font-black ${partnerSummary.totalRemainingBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
              {fmt(partnerSummary.totalRemainingBalance)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Available to draw
            </p>
          </div>
        </div>
      </div>

      {/* 4. Profit Sharing Percentage Health Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
        partnerSummary.isShareBalanced
          ? 'bg-emerald-50/50 dark:bg-neutral-950 border-emerald-200 dark:border-neutral-800 text-emerald-900 dark:text-emerald-200'
          : 'bg-rose-50 dark:bg-neutral-950 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-300'
      }`}>
        <div className="flex items-center gap-2.5">
          {partnerSummary.isShareBalanced ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <div>
            <span className="font-extrabold block">
              Total Partner Shares: {partnerSummary.totalSharePct}% {partnerSummary.isShareBalanced ? '(100% Balanced)' : '(Action Required: Must equal exactly 100%)'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {partnerSummary.partnerMetrics.map(p => `${p.name}: ${p.sharePct}%`).join(' • ')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {partnerSummary.partnerMetrics.map((p, i) => (
            <span key={i} className="px-2 py-0.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-[11px] font-bold">
              {p.name}: <strong className="text-emerald-600 dark:text-emerald-400">{p.sharePct}%</strong>
            </span>
          ))}
        </div>
      </div>

      {/* 5. Partners Directory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {partnerSummary.partnerMetrics.map(partner => {
          return (
            <div
              key={partner.id}
              className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between hover:border-emerald-500/40 transition-all"
            >
              <div>
                {/* Top: Name, Avatar, Share Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-emerald-600/30">
                      {partner.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-white leading-tight">
                        {partner.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Joined {formatDate(partner.joiningDate)}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 text-xs font-black border border-emerald-200/60 dark:border-neutral-800">
                    {partner.sharePct}% Share
                  </span>
                </div>

                {/* Dual-Role Labour Indicator */}
                {partner.isLabour ? (
                  <div
                    onClick={() => navigate('/labour')}
                    className="mt-3 p-2 rounded-xl bg-amber-50/60 dark:bg-neutral-900/80 border border-amber-200/60 dark:border-neutral-800 flex items-center justify-between text-xs cursor-pointer hover:border-amber-400 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <HardHat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-bold text-amber-800 dark:text-amber-300 text-[11px]">
                        Active Worker: {partner.jobRole || 'Kitchen Staff'}
                      </span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-amber-500" />
                  </div>
                ) : (
                  <div className="mt-3 p-2 rounded-xl bg-slate-50 dark:bg-neutral-900/40 border border-slate-100 dark:border-neutral-800 text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Business Partner & Investor</span>
                  </div>
                )}

                {/* Financial Numbers Strip */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-neutral-800/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Allocated Profit ({partner.sharePct}%):</span>
                    <span className="font-black text-slate-900 dark:text-white">{fmt(partner.allocatedProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Total Withdrawals:</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">-{fmt(partner.totalWithdrawals)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-neutral-800">
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">Remaining Balance:</span>
                    <span className={`font-black text-sm ${partner.remainingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                      {fmt(partner.remainingBalance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-neutral-800 flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openWithdrawModal(partner)}
                  icon={DollarSign}
                  className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  Withdraw
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openStatementModal(partner)}
                  className="text-xs border-slate-200 dark:border-neutral-800"
                  title="View statement & history"
                >
                  Statement
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditPartnerModal(partner)}
                  icon={Edit2}
                  className="text-xs p-2 border-slate-200 dark:border-neutral-800"
                  title="Edit Partner"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 6. Partner Withdrawals History Table */}
      <Card
        title="Partner Profit Withdrawals Ledger"
        subtitle={`Historical partner drawings from ${startDate} to ${endDate}`}
        icon={CreditCard}
        action={
          <Button
            size="sm"
            variant="outline"
            icon={Plus}
            onClick={() => {
              const firstPartner = partnerSummary.partnerMetrics[0];
              if (firstPartner) openWithdrawModal(firstPartner);
            }}
            className="text-xs"
          >
            Record Withdrawal
          </Button>
        }
        noPadding
      >
        <Table
          columns={[
            {
              header: 'Date',
              accessor: 'date',
              render: (r) => <span className="font-bold text-xs">{formatDate(r.date)}</span>
            },
            {
              header: 'Partner',
              accessor: 'partnerName',
              render: (r) => (
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    {r.partnerName?.[0] || 'P'}
                  </span>
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white">{r.partnerName}</span>
                </div>
              )
            },
            {
              header: 'Reference',
              accessor: 'id',
              render: (r) => <span className="font-mono text-[11px] text-slate-400">{r.id}</span>
            },
            {
              header: 'Payment Method',
              accessor: 'paymentMethod',
              render: (r) => <Badge variant="info">{r.paymentMethod || 'Cash'}</Badge>
            },
            {
              header: 'Notes / Description',
              accessor: 'notes',
              render: (r) => <span className="text-xs text-slate-500 dark:text-slate-400">{r.notes || '—'}</span>
            },
            {
              header: 'Amount Withdrawn',
              accessor: 'amount',
              render: (r) => <span className="font-black text-xs text-rose-600 dark:text-rose-400">{fmt(r.amount)}</span>
            }
          ]}
          data={(data?.partnerWithdrawals || []).filter(w => isWithinDateRange(w.date, startDate, endDate))}
          emptyMessage="No partner withdrawals recorded in this period."
        />
      </Card>

      {/* ========================================================= */}
      {/* MODAL 1: RECORD WITHDRAWAL                                */}
      {/* ========================================================= */}
      {isWithdrawModalOpen && selectedPartnerForWithdraw && (
        <Modal
          isOpen={isWithdrawModalOpen}
          onClose={() => setIsWithdrawModalOpen(false)}
          title={`Record Profit Withdrawal — ${selectedPartnerForWithdraw.name}`}
          subtitle="Record profit distribution drawn from equity pool"
        >
          <form onSubmit={handleWithdrawSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Available Remaining Balance:</span>
                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {fmt(selectedPartnerForWithdraw.remainingBalance)}
                </span>
              </div>
              <Badge variant="success">{selectedPartnerForWithdraw.profitShare}% Share</Badge>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Withdrawal Amount ({currency}) *
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount to draw..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
              />
              {Number(withdrawAmount) > selectedPartnerForWithdraw.remainingBalance && selectedPartnerForWithdraw.remainingBalance > 0 && (
                <p className="text-[11px] text-amber-500 font-semibold mt-1">
                  ⚠️ Note: Amount exceeds the current period's allocated balance. This will create an advance drawing.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={withdrawDate}
                  onChange={(e) => setWithdrawDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                <select
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                >
                  <option value="Cash">Cash in Hand</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI / Online</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Description</label>
              <input
                type="text"
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                placeholder="Optional notes or purpose..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsWithdrawModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Confirm Withdrawal
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD / EDIT PARTNER                               */}
      {/* ========================================================= */}
      {isPartnerModalOpen && (
        <Modal
          isOpen={isPartnerModalOpen}
          onClose={() => setIsPartnerModalOpen(false)}
          title={editingPartner ? `Edit Partner — ${editingPartner.name}` : 'Add New Partner'}
          subtitle="Configure partner identity, profit share percentage, and dual role"
        >
          <form onSubmit={handlePartnerSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Partner full name..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={partnerForm.phone}
                  onChange={(e) => setPartnerForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 918089974243"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Profit Share Percentage (%) *</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max="100"
                  required
                  value={partnerForm.profitShare}
                  onChange={(e) => setPartnerForm(prev => ({ ...prev, profitShare: e.target.value }))}
                  placeholder="e.g. 40, 30, 30"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-black text-emerald-600 dark:text-emerald-400"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Total of all partners must equal exactly 100%.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Joining Date</label>
                <input
                  type="date"
                  value={partnerForm.joiningDate}
                  onChange={(e) => setPartnerForm(prev => ({ ...prev, joiningDate: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Address (Optional)</label>
              <input
                type="text"
                value={partnerForm.address}
                onChange={(e) => setPartnerForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="City, State..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            {/* Dual Role Checkbox: Partner also works as Labourer */}
            <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-neutral-900 border border-amber-200/80 dark:border-neutral-800 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={partnerForm.isLabour}
                  onChange={(e) => setPartnerForm(prev => ({ ...prev, isLabour: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="font-extrabold text-xs text-amber-900 dark:text-amber-200">
                  Active Worker (Labourer Role)
                </span>
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Check this if this partner also actively works in the kitchen (e.g. Rayya and Fathima). Creates a unified profile with separate salary tracking.
              </p>

              {partnerForm.isLabour && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-amber-200/60 dark:border-neutral-800">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Job Role</label>
                    <input
                      type="text"
                      value={partnerForm.jobRole}
                      onChange={(e) => setPartnerForm(prev => ({ ...prev, jobRole: e.target.value }))}
                      placeholder="e.g. Head Chef"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Salary Type</label>
                    <select
                      value={partnerForm.salaryType}
                      onChange={(e) => setPartnerForm(prev => ({ ...prev, salaryType: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-white font-bold"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Daily">Daily Wage</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Salary Amount ({currency})</label>
                    <input
                      type="number"
                      value={partnerForm.salaryAmount}
                      onChange={(e) => setPartnerForm(prev => ({ ...prev, salaryAmount: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-neutral-800">
              {editingPartner ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsPartnerModalOpen(false);
                    handleDeletePartner(editingPartner);
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Partner
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsPartnerModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  Save Partner
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PARTNER DETAILED STATEMENT                       */}
      {/* ========================================================= */}
      {isStatementModalOpen && selectedPartnerForStatement && (
        <Modal
          isOpen={isStatementModalOpen}
          onClose={() => setIsStatementModalOpen(false)}
          title={`Partner Statement: ${selectedPartnerForStatement.name}`}
          subtitle={`Profit distribution and drawings from ${startDate} to ${endDate}`}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportPDF(selectedPartnerForStatement)}
                icon={Download}
                className="text-xs"
              >
                Export PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsStatementModalOpen(false)}
              >
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Top Profile Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 flex justify-between items-center text-xs">
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white">
                  {selectedPartnerForStatement.name} ({selectedPartnerForStatement.profitShare}% Share)
                </h4>
                <p className="text-slate-400 mt-0.5">
                  Phone: {selectedPartnerForStatement.phone || '—'} • Joined {formatDate(selectedPartnerForStatement.joiningDate)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Balance</span>
                <span className="font-black text-base text-emerald-600 dark:text-emerald-400">
                  {fmt(selectedPartnerForStatement.remainingBalance)}
                </span>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Distributable Profit</span>
                <span className="font-black text-slate-900 dark:text-white mt-0.5 block">{fmt(partnerSummary.totalDistributableProfit)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Allocated ({selectedPartnerForStatement.profitShare}%)</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{fmt(selectedPartnerForStatement.allocatedProfit)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Withdrawn</span>
                <span className="font-black text-rose-600 dark:text-rose-400 mt-0.5 block">{fmt(selectedPartnerForStatement.totalWithdrawals)}</span>
              </div>
            </div>

            {/* Withdrawals List */}
            <div>
              <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-2">Withdrawal Records</h5>
              <div className="divide-y divide-slate-100 dark:divide-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                {(selectedPartnerForStatement.withdrawalsList || []).length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    No withdrawals recorded for this partner in this period.
                  </div>
                ) : (
                  (selectedPartnerForStatement.withdrawalsList || []).map((w, idx) => (
                    <div key={idx} className="p-3 flex justify-between items-center text-xs bg-white dark:bg-black">
                      <div>
                        <span className="font-black text-slate-900 dark:text-white block">{formatDate(w.date)}</span>
                        <span className="text-[11px] text-slate-400">{w.paymentMethod} • {w.notes || 'Drawing'}</span>
                      </div>
                      <span className="font-black text-rose-600 dark:text-rose-400">-{fmt(w.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
