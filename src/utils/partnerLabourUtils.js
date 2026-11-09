/**
 * Partner & Labour Financial Calculation Utilities
 * 
 * Centralizes all profit distribution, partner withdrawal tracking,
 * and labour salary calculations with 100% financial consistency.
 */

export const fmtCurrency = (val, symbol = '₹') => 
  `${symbol} ${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Filter transactions/records by date range (inclusive)
 */
export const isWithinDateRange = (dateStr, startDate, endDate) => {
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  if (startDate && d < startDate) return false;
  if (endDate && d > endDate) return false;
  return true;
};

/**
 * Calculate Business Financial Metrics for a specific date range
 * 
 * Rules:
 * - Net Profit = Total Revenue - Direct Purchases - Operating Overheads - Labour Salaries
 * - Salaries are tracked as an operating expense (category: 'Salaries')
 * - Partner profit withdrawals are NOT operating expenses and NEVER reduce Net Profit
 */
export const calculateBusinessFinancials = ({
  sales = [],
  purchases = [],
  expenses = [],
  startDate = null,
  endDate = null,
  reserveDeduction = 0
}) => {
  const filteredSales = sales.filter(s => isWithinDateRange(s.date, startDate, endDate));
  const filteredPurchases = purchases.filter(p => isWithinDateRange(p.date, startDate, endDate));
  const filteredExpenses = expenses.filter(e => isWithinDateRange(e.date, startDate, endDate));

  const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

  // Separate non-salary operating overheads from labour salaries to avoid double counting
  const salaryExpenses = filteredExpenses
    .filter(e => String(e.category || '').toLowerCase() === 'salaries')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const nonSalaryExpenses = filteredExpenses
    .filter(e => String(e.category || '').toLowerCase() !== 'salaries')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalOperatingExpenses = nonSalaryExpenses;
  const totalSalaries = salaryExpenses;

  // Net Business Profit
  const netProfit = totalRevenue - totalPurchases - totalOperatingExpenses - totalSalaries;

  // Distributable Profit after any approved business reinvestment/reserve allocations
  const approvedAllocations = Number(reserveDeduction || 0);
  const distributableProfit = Math.max(0, netProfit - approvedAllocations);

  return {
    totalRevenue,
    totalPurchases,
    totalOperatingExpenses,
    totalSalaries,
    totalExpensesAll: totalOperatingExpenses + totalSalaries,
    netProfit,
    approvedAllocations,
    distributableProfit,
    salesCount: filteredSales.length,
    purchasesCount: filteredPurchases.length
  };
};

/**
 * Calculate Partner Profit Allocations & Remaining Balances
 */
export const calculatePartnerSummary = ({
  partners = [],
  distributableProfit = 0,
  partnerWithdrawals = [],
  startDate = null,
  endDate = null
}) => {
  const activePartners = partners.filter(p => p.status !== 'Inactive');
  const totalSharePct = activePartners.reduce((sum, p) => sum + Number(p.profitShare || 0), 0);

  const partnerMetrics = activePartners.map(p => {
    const sharePct = Number(p.profitShare || 0);
    // Partner's share of distributable profit for period
    const allocatedProfit = (distributableProfit * sharePct) / 100;

    // Total withdrawals by this partner in period
    const partnerDrawings = partnerWithdrawals.filter(w => 
      String(w.partnerId) === String(p.id) && isWithinDateRange(w.date, startDate, endDate)
    );
    const totalWithdrawals = partnerDrawings.reduce((sum, w) => sum + Number(w.amount || 0), 0);

    // Remaining balance
    const remainingBalance = allocatedProfit - totalWithdrawals;

    return {
      ...p,
      sharePct,
      allocatedProfit,
      totalWithdrawals,
      remainingBalance,
      withdrawalsList: partnerDrawings
    };
  });

  const totalAllocatedProfit = partnerMetrics.reduce((sum, p) => sum + p.allocatedProfit, 0);
  const totalWithdrawals = partnerMetrics.reduce((sum, p) => sum + p.totalWithdrawals, 0);
  const totalRemainingBalance = partnerMetrics.reduce((sum, p) => sum + p.remainingBalance, 0);

  return {
    activePartnersCount: activePartners.length,
    totalSharePct,
    isShareBalanced: Math.round(totalSharePct) === 100,
    totalDistributableProfit: distributableProfit,
    totalAllocatedProfit,
    totalWithdrawals,
    totalRemainingBalance,
    partnerMetrics
  };
};

/**
 * Calculate Labourers Salaries, Attendance, Paid and Pending amounts
 */
export const calculateLabourSummary = ({
  labourers = [],
  salaryPayments = [],
  attendance = [],
  month = null,
  startDate = null,
  endDate = null
}) => {
  const activeLabourers = labourers.filter(l => l.status !== 'Inactive');

  const labourMetrics = activeLabourers.map(l => {
    // 1. Calculate working days and attendance
    const workerAttendance = attendance.filter(a => 
      String(a.labourId) === String(l.id) &&
      (!month || (a.date && a.date.startsWith(month))) &&
      isWithinDateRange(a.date, startDate, endDate)
    );

    const daysPresent = workerAttendance.filter(a => a.status === 'Present').length;
    const halfDays = workerAttendance.filter(a => a.status === 'Half Day').length;
    const paidLeaves = workerAttendance.filter(a => a.status === 'Paid Leave').length;
    const effectiveDaysWorked = daysPresent + (halfDays * 0.5) + paidLeaves;

    // 2. Calculate Earned Salary
    const baseSalary = Number(l.salaryAmount || 0);
    const standardWorkingDays = Number(l.workingDays || 26);
    let earnedSalary = 0;

    if (l.salaryType === 'Daily') {
      earnedSalary = effectiveDaysWorked > 0 ? (baseSalary * effectiveDaysWorked) : (baseSalary * standardWorkingDays);
    } else {
      // Monthly Salary
      if (effectiveDaysWorked > 0 && effectiveDaysWorked < standardWorkingDays) {
        // Pro-rated if attendance is explicitly tracked
        earnedSalary = (baseSalary / standardWorkingDays) * effectiveDaysWorked;
      } else {
        earnedSalary = baseSalary;
      }
    }

    // 3. Calculate Paid Salary
    const workerPayments = salaryPayments.filter(p => 
      String(p.labourId) === String(l.id) &&
      (!month || p.month === month || (p.date && p.date.startsWith(month))) &&
      isWithinDateRange(p.date, startDate, endDate)
    );
    const totalPaid = workerPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // 4. Pending Salary
    const pendingSalary = Math.max(0, earnedSalary - totalPaid);

    return {
      ...l,
      baseSalary,
      standardWorkingDays,
      effectiveDaysWorked,
      earnedSalary,
      totalPaid,
      pendingSalary,
      paymentsList: workerPayments,
      attendanceList: workerAttendance
    };
  });

  const totalMonthlySalaryExpense = labourMetrics.reduce((sum, l) => sum + l.earnedSalary, 0);
  const totalSalaryPaid = labourMetrics.reduce((sum, l) => sum + l.totalPaid, 0);
  const totalPendingSalary = labourMetrics.reduce((sum, l) => sum + l.pendingSalary, 0);

  return {
    totalActiveLabourers: activeLabourers.length,
    totalMonthlySalaryExpense,
    totalSalaryPaid,
    totalPendingSalary,
    labourMetrics
  };
};
