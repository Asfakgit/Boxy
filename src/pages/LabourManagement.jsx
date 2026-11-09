import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { useNavigate } from 'react-router-dom';
import {
  calculateLabourSummary,
  fmtCurrency
} from '../utils/partnerLabourUtils';
import { exportLabourStatementPDF } from '../utils/pdfExportUtils';
import {
  HardHat,
  Users,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Download,
  Edit2,
  Trash2,
  UserCheck,
  CreditCard,
  Building2,
  ArrowRight,
  TrendingUp,
  Percent
} from 'lucide-react';

export const LabourManagement = () => {
  const { data, saveLabourer, deleteLabourer, recordSalaryPayment, recordAttendance, showToast, showConfirmDialog } = useApp();
  const navigate = useNavigate();

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => fmtCurrency(val, currency);

  // 1. DATE RANGE STATE
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);
  const startOfMonthStr = useMemo(() => `${currentMonthStr}-01`, [currentMonthStr]);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [startDate, setStartDate] = useState(startOfMonthStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState('this-month');

  const handlePresetChange = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'all-time') {
      setStartDate('2020-01-01');
      setEndDate(todayStr);
      setSelectedMonth('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
      setSelectedMonth(currentMonthStr);
    } else if (preset === 'this-month') {
      setStartDate(startOfMonthStr);
      setEndDate(todayStr);
      setSelectedMonth(currentMonthStr);
    } else if (preset === 'last-month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthStr = prev.toISOString().slice(0, 7);
      const prevLastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(`${prevMonthStr}-01`);
      setEndDate(prevLastDay);
      setSelectedMonth(prevMonthStr);
    } else if (preset === 'this-year') {
      setStartDate(`${now.getFullYear()}-01-01`);
      setEndDate(todayStr);
      setSelectedMonth('');
    }
  };

  // 2. LABOUR CALCULATIONS
  const labourSummary = useMemo(() => {
    return calculateLabourSummary({
      labourers: data?.labourers || [],
      salaryPayments: data?.salaryPayments || [],
      attendance: data?.attendance || [],
      month: activePreset === 'all-time' ? null : selectedMonth,
      startDate: activePreset === 'all-time' ? null : startDate,
      endDate: activePreset === 'all-time' ? null : endDate
    });
  }, [data?.labourers, data?.salaryPayments, data?.attendance, selectedMonth, startDate, endDate, activePreset]);

  // 3. MODAL STATES
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedLabourerForPayment, setSelectedLabourerForPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentMonth, setPaymentMonth] = useState(currentMonthStr);
  const [paymentNotes, setPaymentNotes] = useState('');

  const [isLabourModalOpen, setIsLabourModalOpen] = useState(false);
  const [editingLabourer, setEditingLabourer] = useState(null);
  const [labourForm, setLabourForm] = useState({
    partnerId: '',
    name: '',
    phone: '',
    jobRole: 'Kitchen Chef',
    salaryType: 'Monthly',
    salaryAmount: 18000,
    workingDays: 26,
    joiningDate: todayStr,
    status: 'Active',
    notes: ''
  });

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedLabourerForAtt, setSelectedLabourerForAtt] = useState(null);
  const [attDate, setAttDate] = useState(todayStr);
  const [attStatus, setAttStatus] = useState('Present');
  const [attHours, setAttHours] = useState('8');
  const [attNotes, setAttNotes] = useState('');

  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [selectedLabourerForStatement, setSelectedLabourerForStatement] = useState(null);

  // 4. HANDLERS
  const openPaymentModal = (labourer) => {
    setSelectedLabourerForPayment(labourer);
    setPaymentAmount(String(labourer.pendingSalary > 0 ? labourer.pendingSalary : labourer.earnedSalary || ''));
    setPaymentMethod('Cash');
    setPaymentDate(todayStr);
    setPaymentMonth(selectedMonth || currentMonthStr);
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLabourerForPayment || !paymentAmount || Number(paymentAmount) <= 0) {
      showToast('Please enter a valid salary amount.', 'error');
      return;
    }

    const numAmount = Number(paymentAmount);
    await recordSalaryPayment({
      labourId: selectedLabourerForPayment.id,
      labourName: selectedLabourerForPayment.name,
      amount: numAmount,
      paymentMethod,
      date: paymentDate,
      month: paymentMonth,
      notes: paymentNotes || `Salary payment for ${paymentMonth}`
    });

    setIsPaymentModalOpen(false);
  };

  const openAddLabourModal = () => {
    setEditingLabourer(null);
    setLabourForm({
      partnerId: '',
      name: '',
      phone: '',
      jobRole: 'Kitchen Assistant',
      salaryType: 'Monthly',
      salaryAmount: 15000,
      workingDays: 26,
      joiningDate: todayStr,
      status: 'Active',
      notes: ''
    });
    setIsLabourModalOpen(true);
  };

  const openEditLabourModal = (labourer) => {
    setEditingLabourer(labourer);
    setLabourForm({
      partnerId: labourer.partnerId || '',
      name: labourer.name || '',
      phone: labourer.phone || '',
      jobRole: labourer.jobRole || 'Kitchen Chef',
      salaryType: labourer.salaryType || 'Monthly',
      salaryAmount: labourer.salaryAmount || 15000,
      workingDays: labourer.workingDays || 26,
      joiningDate: labourer.joiningDate || todayStr,
      status: labourer.status || 'Active',
      notes: labourer.notes || ''
    });
    setIsLabourModalOpen(true);
  };

  const handleLabourSubmit = async (e) => {
    e.preventDefault();
    if (!labourForm.name.trim()) {
      showToast('Worker name is required.', 'error');
      return;
    }

    await saveLabourer({
      ...(editingLabourer || {}),
      partnerId: labourForm.partnerId || null,
      name: labourForm.name.trim(),
      phone: labourForm.phone.trim(),
      jobRole: labourForm.jobRole.trim(),
      salaryType: labourForm.salaryType,
      salaryAmount: Number(labourForm.salaryAmount || 0),
      workingDays: Number(labourForm.workingDays || 26),
      joiningDate: labourForm.joiningDate,
      status: labourForm.status,
      notes: labourForm.notes
    });

    setIsLabourModalOpen(false);
  };

  const handleDeleteLabourer = (labourer) => {
    showConfirmDialog({
      title: `Remove Worker: ${labourer.name}?`,
      message: `Are you sure you want to remove ${labourer.name}? Historical payment records will be preserved.`,
      type: 'danger',
      confirmText: 'Yes, Remove Worker',
      onConfirm: () => deleteLabourer(labourer.id)
    });
  };

  const openAttendanceModal = (labourer = null) => {
    setSelectedLabourerForAtt(labourer || labourSummary.labourMetrics[0] || null);
    setAttDate(todayStr);
    setAttStatus('Present');
    setAttHours('8');
    setAttNotes('');
    setIsAttendanceModalOpen(true);
  };

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLabourerForAtt) {
      showToast('Please select a worker.', 'error');
      return;
    }

    await recordAttendance({
      labourId: selectedLabourerForAtt.id,
      labourName: selectedLabourerForAtt.name,
      date: attDate,
      status: attStatus,
      workingHours: Number(attHours || 8),
      notes: attNotes
    });

    setIsAttendanceModalOpen(false);
  };

  const openStatementModal = (labourer) => {
    setSelectedLabourerForStatement(labourer);
    setIsStatementModalOpen(true);
  };

  const handleExportPDF = (labourer) => {
    exportLabourStatementPDF({
      labourer,
      payments: labourer.paymentsList || [],
      attendance: labourer.attendanceList || [],
      dateRange: { startDate, endDate },
      settings: data?.settings || {},
      currency
    });
    showToast(`Salary statement downloaded for ${labourer.name}!`, 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <HardHat className="w-6 h-6 text-amber-500" />
            <span>Labour Management</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track kitchen staff, wages, attendance, and salary expense records
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/partners')}
            icon={Users}
            className="text-xs border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300"
          >
            Partners Section
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openAttendanceModal()}
            icon={Clock}
            className="text-xs border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300"
          >
            Mark Attendance
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openAddLabourModal}
            icon={Plus}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md shadow-amber-600/20"
          >
            Add Worker
          </Button>
        </div>
      </div>

      {/* 2. Date Presets & Range Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <span className="text-xs font-bold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500" /> Period:
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
                    ? 'bg-amber-600 text-white shadow-xs'
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

      {/* 3. Labour Financial Dashboard (4 KPI Metric Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Active Workers */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Labourers</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-neutral-900 text-amber-600 dark:text-amber-400">
              <HardHat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {labourSummary.totalActiveLabourers} Workers
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Including partner active staff
            </p>
          </div>
        </div>

        {/* Total Salary Expense */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Salary Expense</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-neutral-900 text-rose-600 dark:text-rose-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {fmt(labourSummary.totalMonthlySalaryExpense)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Deducted as business expense
            </p>
          </div>
        </div>

        {/* Total Salary Paid */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Salary Paid</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {fmt(labourSummary.totalSalaryPaid)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Paid wages in this period
            </p>
          </div>
        </div>

        {/* Total Pending Salary */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Salaries</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-neutral-900 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className={`text-xl sm:text-2xl font-black ${labourSummary.totalPendingSalary > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
              {fmt(labourSummary.totalPendingSalary)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Wages due to workers
            </p>
          </div>
        </div>
      </div>

      {/* 4. Workers Directory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {labourSummary.labourMetrics.map(worker => {
          return (
            <div
              key={worker.id}
              className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between hover:border-amber-500/40 transition-all"
            >
              <div>
                {/* Top: Name, Role, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-amber-500/30">
                      {worker.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-white leading-tight">
                        {worker.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {worker.jobRole || 'Kitchen Worker'}
                      </p>
                    </div>
                  </div>

                  <Badge variant={worker.status === 'Active' ? 'success' : 'default'}>
                    {worker.status || 'Active'}
                  </Badge>
                </div>

                {/* Linked Partner Indicator */}
                {worker.partnerId && (
                  <div
                    onClick={() => navigate('/partners')}
                    className="mt-3 p-2 rounded-xl bg-emerald-50/60 dark:bg-neutral-900/80 border border-emerald-200/60 dark:border-neutral-800 flex items-center justify-between text-xs cursor-pointer hover:border-emerald-400 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 text-[11px]">
                        Business Partner (30% Profit Share)
                      </span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-emerald-500" />
                  </div>
                )}

                {/* Salary Info Strip */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-neutral-800/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Salary Structure:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {fmt(worker.baseSalary)} / {worker.salaryType === 'Daily' ? 'Day' : 'Month'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Earned This Period:</span>
                    <span className="font-black text-slate-900 dark:text-white">{fmt(worker.earnedSalary)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Total Paid:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(worker.totalPaid)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-neutral-800">
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">Pending Amount:</span>
                    <span className={`font-black text-sm ${worker.pendingSalary > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {fmt(worker.pendingSalary)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-neutral-800 flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openPaymentModal(worker)}
                  icon={DollarSign}
                  className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 font-bold"
                >
                  Pay Salary
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAttendanceModal(worker)}
                  icon={Clock}
                  className="text-xs border-slate-200 dark:border-neutral-800"
                  title="Mark Attendance"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openStatementModal(worker)}
                  className="text-xs border-slate-200 dark:border-neutral-800"
                  title="View Salary History"
                >
                  History
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditLabourModal(worker)}
                  icon={Edit2}
                  className="text-xs p-2 border-slate-200 dark:border-neutral-800"
                  title="Edit Worker"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Salary Payments History Table */}
      <Card
        title="Labour Salary Payments Ledger"
        subtitle={`Audit records of all worker wages paid from ${startDate} to ${endDate}`}
        icon={CreditCard}
        action={
          <Button
            size="sm"
            variant="outline"
            icon={Plus}
            onClick={() => {
              const first = labourSummary.labourMetrics[0];
              if (first) openPaymentModal(first);
            }}
            className="text-xs"
          >
            Pay Salary
          </Button>
        }
        noPadding
      >
        <Table
          columns={[
            {
              header: 'Payment Date',
              accessor: 'date',
              render: (r) => <span className="font-bold text-xs">{r.date ? new Date(r.date).toLocaleDateString('en-GB') : '—'}</span>
            },
            {
              header: 'Worker / Labourer',
              accessor: 'labourName',
              render: (r) => (
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-neutral-900 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    {r.labourName?.[0] || 'L'}
                  </span>
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white">{r.labourName}</span>
                </div>
              )
            },
            {
              header: 'Salary Month',
              accessor: 'month',
              render: (r) => <Badge variant="warning">{r.month || 'Current'}</Badge>
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
              header: 'Amount Paid',
              accessor: 'amount',
              render: (r) => <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">{fmt(r.amount)}</span>
            }
          ]}
          data={(data?.salaryPayments || []).filter(p => isWithinDateRange(p.date, startDate, endDate))}
          emptyMessage="No salary payments logged in this period."
        />
      </Card>

      {/* ========================================================= */}
      {/* MODAL 1: RECORD SALARY PAYMENT                            */}
      {/* ========================================================= */}
      {isPaymentModalOpen && selectedLabourerForPayment && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title={`Pay Salary — ${selectedLabourerForPayment.name}`}
          subtitle="Record wage payment to employee. Automatically logs as business operating expense."
        >
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Pending Wage Due:</span>
                <span className="font-black text-sm text-rose-600 dark:text-rose-400 mt-0.5 block">
                  {fmt(selectedLabourerForPayment.pendingSalary)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block font-medium">Standard Salary:</span>
                <span className="font-black text-xs text-slate-900 dark:text-white mt-0.5 block">
                  {fmt(selectedLabourerForPayment.baseSalary)} / {selectedLabourerForPayment.salaryType}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Payment Amount ({currency}) *
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter wage amount to pay..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Salary Month</label>
                <input
                  type="month"
                  required
                  value={paymentMonth}
                  onChange={(e) => setPaymentMonth(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                >
                  <option value="Cash">Cash in Hand</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI / Online</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Regular monthly wage"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                Confirm Salary Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD / EDIT WORKER                                */}
      {/* ========================================================= */}
      {isLabourModalOpen && (
        <Modal
          isOpen={isLabourModalOpen}
          onClose={() => setIsLabourModalOpen(false)}
          title={editingLabourer ? `Edit Worker — ${editingLabourer.name}` : 'Add New Labourer / Worker'}
          subtitle="Configure worker details, salary structure, and partner association"
        >
          <form onSubmit={handleLabourSubmit} className="space-y-4">
            {/* Link from Partner */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Link to Business Partner (Optional)
              </label>
              <select
                value={labourForm.partnerId}
                onChange={(e) => {
                  const pId = e.target.value;
                  const partner = (data?.partners || []).find(p => p.id === pId);
                  setLabourForm(prev => ({
                    ...prev,
                    partnerId: pId,
                    name: partner ? partner.name : prev.name,
                    phone: partner ? partner.phone : prev.phone
                  }));
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
              >
                <option value="">None (Independent Worker / Employee)</option>
                {(data?.partners || []).map(p => (
                  <option key={p.id} value={p.id}>
                    Partner: {p.name} ({p.profitShare}% Share)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Worker Name *</label>
                <input
                  type="text"
                  required
                  value={labourForm.name}
                  onChange={(e) => setLabourForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Full name..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={labourForm.phone}
                  onChange={(e) => setLabourForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Job Role</label>
                <input
                  type="text"
                  required
                  value={labourForm.jobRole}
                  onChange={(e) => setLabourForm(prev => ({ ...prev, jobRole: e.target.value }))}
                  placeholder="e.g. Head Chef, Helper"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Salary Type</label>
                <select
                  value={labourForm.salaryType}
                  onChange={(e) => setLabourForm(prev => ({ ...prev, salaryType: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                >
                  <option value="Monthly">Monthly Fixed</option>
                  <option value="Daily">Daily Wage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Salary Amount ({currency}) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={labourForm.salaryAmount}
                  onChange={(e) => setLabourForm(prev => ({ ...prev, salaryAmount: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-black text-amber-600 dark:text-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Standard Working Days / Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={labourForm.workingDays}
                  onChange={(e) => setLabourForm(prev => ({ ...prev, workingDays: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={labourForm.status}
                  onChange={(e) => setLabourForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                >
                  <option value="Active">Active Employee</option>
                  <option value="Inactive">Inactive / On Leave</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-neutral-800">
              {editingLabourer ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsLabourModalOpen(false);
                    handleDeleteLabourer(editingLabourer);
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Worker
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsLabourModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  Save Worker
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: MARK ATTENDANCE                                  */}
      {/* ========================================================= */}
      {isAttendanceModalOpen && selectedLabourerForAtt && (
        <Modal
          isOpen={isAttendanceModalOpen}
          onClose={() => setIsAttendanceModalOpen(false)}
          title={`Mark Attendance — ${selectedLabourerForAtt.name}`}
          subtitle="Record daily working shift or leave status"
        >
          <form onSubmit={handleAttendanceSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Labourer</label>
              <select
                value={selectedLabourerForAtt.id}
                onChange={(e) => {
                  const target = labourSummary.labourMetrics.find(l => l.id === e.target.value);
                  if (target) setSelectedLabourerForAtt(target);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
              >
                {labourSummary.labourMetrics.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.jobRole})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Attendance Status</label>
                <select
                  value={attStatus}
                  onChange={(e) => setAttStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl font-bold text-slate-900 dark:text-white"
                >
                  <option value="Present">Present (Full Day)</option>
                  <option value="Half Day">Half Day (0.5)</option>
                  <option value="Paid Leave">Paid Leave</option>
                  <option value="Absent">Absent (Unpaid)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAttendanceModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                Save Attendance
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: WORKER STATEMENT & PAYMENT HISTORY               */}
      {/* ========================================================= */}
      {isStatementModalOpen && selectedLabourerForStatement && (
        <Modal
          isOpen={isStatementModalOpen}
          onClose={() => setIsStatementModalOpen(false)}
          title={`Salary Statement: ${selectedLabourerForStatement.name}`}
          subtitle={`Audit records and wage breakdown for ${startDate} to ${endDate}`}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportPDF(selectedLabourerForStatement)}
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
            {/* Top Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 flex justify-between items-center text-xs">
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white">
                  {selectedLabourerForStatement.name}
                </h4>
                <p className="text-slate-400 mt-0.5">
                  {selectedLabourerForStatement.jobRole} • Phone: {selectedLabourerForStatement.phone || '—'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending Due</span>
                <span className={`font-black text-base ${selectedLabourerForStatement.pendingSalary > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {fmt(selectedLabourerForStatement.pendingSalary)}
                </span>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Base Structure</span>
                <span className="font-black text-slate-900 dark:text-white mt-0.5 block">{fmt(selectedLabourerForStatement.baseSalary)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Earned</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">{fmt(selectedLabourerForStatement.earnedSalary)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Paid</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{fmt(selectedLabourerForStatement.totalPaid)}</span>
              </div>
            </div>

            {/* Payment Records */}
            <div>
              <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-2">Payment Records</h5>
              <div className="divide-y divide-slate-100 dark:divide-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                {(selectedLabourerForStatement.paymentsList || []).length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    No wage payments recorded in this period.
                  </div>
                ) : (
                  (selectedLabourerForStatement.paymentsList || []).map((p, idx) => (
                    <div key={idx} className="p-3 flex justify-between items-center text-xs bg-white dark:bg-black">
                      <div>
                        <span className="font-black text-slate-900 dark:text-white block">{p.date ? new Date(p.date).toLocaleDateString('en-GB') : '—'}</span>
                        <span className="text-[11px] text-slate-400">{p.month} • {p.paymentMethod}</span>
                      </div>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">+{fmt(p.amount)}</span>
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
