import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { printHtml } from '../utils/nativeBridge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import {
  exportDailyReportPDF,
  exportMonthlyReportPDF,
  exportCustomReportPDF,
  exportKitchenReportPDF
} from '../utils/pdfExportUtils';
import { BalanceSheetReport } from '../components/reports/BalanceSheetReport';
import { CustomerLedgerReport } from '../components/reports/CustomerLedgerReport';
import { SupplierLedgerReport } from '../components/reports/SupplierLedgerReport';
import { calculateBusinessFinancials, calculatePartnerSummary } from '../utils/partnerLabourUtils';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  CreditCard,
  Filter,
  Search,
  Package,
  ArrowRight,
  ChevronRight,
  PieChart,
  ChefHat,
  Scale,
  Users,
  Building2,
  HeartHandshake
} from 'lucide-react';
import { calculateIngredientCost } from '../utils/unitConverter';
import { formatMoney } from '../utils/format';
import { useCollections } from '../hooks/useCollections';

// Robust date string normalizer (returns YYYY-MM-DD)
const normalizeDate = (raw) => {
  if (!raw) return '';
  if (typeof raw === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    const parts = raw.split(/[-/]/);
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().split('T')[0];
  }
  return '';
};

export const ReportingAnalytics = () => {
  const { data } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'daily');
  const initialCustomerId = searchParams.get('customerId');
  const initialSupplierId = searchParams.get('supplierId');

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    // Only sync when the URL changes; including activeTab would undo in-page tab clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    });
  };

  const currency = data?.settings?.currencySymbol || '₹';
  const appName = data?.settings?.appName || 'Boxy';
  const logo = data?.settings?.logo || '/logo.jpg';
  const fmt = (val) => formatMoney(val, currency);

  const { sales, purchases, expenses, rawMaterials, products, recipes } = useCollections();

  // ==========================================
  // 1. DAILY REPORT STATE & CALCULATIONS
  // ==========================================
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDay, setSelectedDay] = useState(todayStr);

  const dailyData = useMemo(() => {
    const daySales = sales.filter(s => normalizeDate(s.date) === selectedDay);
    const dayPurchases = purchases.filter(p => normalizeDate(p.date) === selectedDay);
    const dayExpenses = expenses.filter(e => normalizeDate(e.date) === selectedDay);

    const totalSales = daySales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const totalPurchases = dayPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalTax = daySales.reduce((sum, s) => sum + Number(s.taxAmount || 0), 0);
    const netProfit = totalSales - totalPurchases - totalExpenses;
    const ordersCount = daySales.length;
    const avgOrderValue = ordersCount > 0 ? totalSales / ordersCount : 0;

    // Payment methods breakdown
    const paymentMethods = {
      Cash: { amount: 0, count: 0 },
      UPI: { amount: 0, count: 0 },
      Card: { amount: 0, count: 0 },
      Credit: { amount: 0, count: 0 }
    };
    daySales.forEach(s => {
      const pm = (s.paymentMethod || 'Cash').toLowerCase();
      let key = 'Cash';
      if (pm.includes('upi') || pm.includes('online')) key = 'UPI';
      else if (pm.includes('card')) key = 'Card';
      else if (pm.includes('credit')) key = 'Credit';

      paymentMethods[key].amount += Number(s.totalAmount || 0);
      paymentMethods[key].count += 1;
    });

    // Items sold breakdown
    const itemsMap = new Map();
    daySales.forEach(sale => {
      if (Array.isArray(sale.items) && sale.items.length > 0) {
        sale.items.forEach(it => {
          const name = it.productName || it.name || 'Unknown Item';
          const qty = Number(it.quantity) || 1;
          const unitPrice = Number(it.price || it.sellingPrice || 0);
          const total = Number(it.subtotal || (unitPrice * qty));
          if (!itemsMap.has(name)) {
            itemsMap.set(name, { name, quantity: 0, revenue: 0, count: 0 });
          }
          const curr = itemsMap.get(name);
          curr.quantity += qty;
          curr.revenue += total;
          curr.count += 1;
        });
      } else if (sale.itemsSummary) {
        String(sale.itemsSummary).split(',').forEach(p => {
          const match = p.trim().match(/^(\d+)x?\s*(.+)$/i);
          if (match) {
            const qty = Number(match[1]) || 1;
            const name = match[2].trim();
            if (!itemsMap.has(name)) {
              itemsMap.set(name, { name, quantity: 0, revenue: 0, count: 0 });
            }
            const curr = itemsMap.get(name);
            curr.quantity += qty;
            curr.count += 1;
          }
        });
      }
    });
    const itemsSold = Array.from(itemsMap.values()).sort((a, b) => b.quantity - a.quantity);

    return {
      daySales,
      dayPurchases,
      dayExpenses,
      totalSales,
      totalPurchases,
      totalExpenses,
      totalTax,
      netProfit,
      ordersCount,
      avgOrderValue,
      paymentMethods,
      itemsSold
    };
  }, [sales, purchases, expenses, selectedDay]);

  // Daily Quick Date Shifts
  const handleShiftDay = (delta) => {
    const current = new Date(selectedDay + 'T00:00:00');
    current.setDate(current.getDate() + delta);
    setSelectedDay(current.toISOString().split('T')[0]);
  };

  // ==========================================
  // 2. MONTHLY REPORT STATE & CALCULATIONS
  // ==========================================
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr); // "YYYY-MM"

  const monthlyData = useMemo(() => {
    const monthSales = sales.filter(s => normalizeDate(s.date).startsWith(selectedMonth));
    const monthPurchases = purchases.filter(p => normalizeDate(p.date).startsWith(selectedMonth));
    const monthExpenses = expenses.filter(e => normalizeDate(e.date).startsWith(selectedMonth));

    const totalSales = monthSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const totalPurchases = monthPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalTax = monthSales.reduce((sum, s) => sum + Number(s.taxAmount || 0), 0);
    const netProfit = totalSales - totalPurchases - totalExpenses;
    const ordersCount = monthSales.length;
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

    // Day-by-Day Calendar breakdown
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const dayLedger = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const dSales = monthSales.filter(s => normalizeDate(s.date) === dateStr);
      const dPurchases = monthPurchases.filter(p => normalizeDate(p.date) === dateStr);
      const dExpenses = monthExpenses.filter(e => normalizeDate(e.date) === dateStr);

      const dSalesAmt = dSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
      const dPurchasesAmt = dPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
      const dExpensesAmt = dExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const dNetProfit = dSalesAmt - dPurchasesAmt - dExpensesAmt;

      dayLedger.push({
        dateStr,
        dayNum: d,
        ordersCount: dSales.length,
        sales: dSalesAmt,
        purchases: dPurchasesAmt,
        expenses: dExpensesAmt,
        netProfit: dNetProfit,
        hasActivity: dSales.length > 0 || dPurchasesAmt > 0 || dExpensesAmt > 0
      });
    }

    // Top Selling Products of the Month
    const itemsMap = new Map();
    monthSales.forEach(sale => {
      if (Array.isArray(sale.items) && sale.items.length > 0) {
        sale.items.forEach(it => {
          const name = it.productName || it.name || 'Unknown Item';
          const qty = Number(it.quantity) || 1;
          const unitPrice = Number(it.price || it.sellingPrice || 0);
          const total = Number(it.subtotal || (unitPrice * qty));
          if (!itemsMap.has(name)) {
            itemsMap.set(name, { name, quantity: 0, revenue: 0 });
          }
          const curr = itemsMap.get(name);
          curr.quantity += qty;
          curr.revenue += total;
        });
      }
    });
    const topProducts = Array.from(itemsMap.values()).sort((a, b) => b.quantity - a.quantity);

    // Monthly Payment Breakdown
    const paymentMethods = {
      Cash: { amount: 0, count: 0 },
      UPI: { amount: 0, count: 0 },
      Card: { amount: 0, count: 0 },
      Credit: { amount: 0, count: 0 }
    };
    monthSales.forEach(s => {
      const pm = (s.paymentMethod || 'Cash').toLowerCase();
      let key = 'Cash';
      if (pm.includes('upi') || pm.includes('online')) key = 'UPI';
      else if (pm.includes('card')) key = 'Card';
      else if (pm.includes('credit')) key = 'Credit';

      paymentMethods[key].amount += Number(s.totalAmount || 0);
      paymentMethods[key].count += 1;
    });

    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`;

    const financials = calculateBusinessFinancials({
      sales,
      purchases,
      expenses,
      salaryPayments: data?.salaryPayments || [],
      filterStartDate: startDate,
      filterEndDate: endDate
    });

    const partnerSummary = calculatePartnerSummary({
      partners: data?.partners || [],
      withdrawals: data?.partnerWithdrawals || [],
      sales,
      purchases,
      expenses,
      salaryPayments: data?.salaryPayments || [],
      filterStartDate: startDate,
      filterEndDate: endDate
    });

    return {
      monthSales,
      monthPurchases,
      monthExpenses,
      totalSales,
      totalPurchases,
      totalExpenses,
      totalTax,
      netProfit,
      ordersCount,
      profitMargin,
      dayLedger,
      topProducts,
      paymentMethods,
      financials,
      partnerSummary
    };
  }, [sales, purchases, expenses, selectedMonth, data?.salaryPayments, data?.partners, data?.partnerWithdrawals]);

  // ==========================================
  // 3. CUSTOMIZED REPORT STATE & CALCULATIONS
  // ==========================================
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  const [customCategoryFilter, setCustomCategoryFilter] = useState('all'); // 'all', 'sales', 'purchases', 'expenses'
  const [customPaymentFilter, setCustomPaymentFilter] = useState('all');
  const [customSearchTerm, setCustomSearchTerm] = useState('');

  // Quick Preset Helper
  const applyPreset = (preset) => {
    const now = new Date();
    const tStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setCustomStartDate(tStr);
      setCustomEndDate(tStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setCustomStartDate(yStr);
      setCustomEndDate(yStr);
    } else if (preset === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setCustomStartDate(d.toISOString().split('T')[0]);
      setCustomEndDate(tStr);
    } else if (preset === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setCustomStartDate(d.toISOString().split('T')[0]);
      setCustomEndDate(tStr);
    } else if (preset === 'thisMonth') {
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setCustomStartDate(firstDay);
      setCustomEndDate(tStr);
    } else if (preset === 'lastMonth') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      setCustomStartDate(lastMonthDate.toISOString().split('T')[0]);
      setCustomEndDate(lastMonthEnd.toISOString().split('T')[0]);
    } else if (preset === 'all') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const customData = useMemo(() => {
    const isWithinRange = (dateStr) => {
      const d = normalizeDate(dateStr);
      if (!d) return false;
      if (customStartDate && d < customStartDate) return false;
      if (customEndDate && d > customEndDate) return false;
      return true;
    };

    // Filter Sales
    let filteredSales = sales.filter(s => isWithinRange(s.date));
    if (customPaymentFilter !== 'all') {
      filteredSales = filteredSales.filter(s => {
        const pm = (s.paymentMethod || 'Cash').toLowerCase();
        if (customPaymentFilter === 'Cash') return pm.includes('cash');
        if (customPaymentFilter === 'UPI') return pm.includes('upi') || pm.includes('online');
        if (customPaymentFilter === 'Card') return pm.includes('card');
        if (customPaymentFilter === 'Credit') return pm.includes('credit');
        return true;
      });
    }
    if (customSearchTerm.trim()) {
      const term = customSearchTerm.toLowerCase();
      filteredSales = filteredSales.filter(s => 
        (s.invoiceNumber || '').toLowerCase().includes(term) ||
        (s.customerName || '').toLowerCase().includes(term) ||
        (s.itemsSummary || '').toLowerCase().includes(term)
      );
    }

    // Filter Purchases
    let filteredPurchases = purchases.filter(p => isWithinRange(p.date));
    if (customSearchTerm.trim()) {
      const term = customSearchTerm.toLowerCase();
      filteredPurchases = filteredPurchases.filter(p => 
        (p.materialNumber || p.id || '').toLowerCase().includes(term) ||
        (p.supplierName || '').toLowerCase().includes(term) ||
        (p.notes || '').toLowerCase().includes(term)
      );
    }

    // Filter Expenses
    let filteredExpenses = expenses.filter(e => isWithinRange(e.date));
    if (customSearchTerm.trim()) {
      const term = customSearchTerm.toLowerCase();
      filteredExpenses = filteredExpenses.filter(e => 
        (e.category || '').toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term)
      );
    }

    const totalSales = filteredSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = totalSales - totalPurchases - totalExpenses;
    const ordersCount = filteredSales.length;

    const financials = calculateBusinessFinancials({
      sales: filteredSales,
      purchases: filteredPurchases,
      expenses: filteredExpenses,
      salaryPayments: data?.salaryPayments || [],
      filterStartDate: customStartDate,
      filterEndDate: customEndDate
    });

    const partnerSummary = calculatePartnerSummary({
      partners: data?.partners || [],
      withdrawals: data?.partnerWithdrawals || [],
      sales: filteredSales,
      purchases: filteredPurchases,
      expenses: filteredExpenses,
      salaryPayments: data?.salaryPayments || [],
      filterStartDate: customStartDate,
      filterEndDate: customEndDate
    });

    return {
      filteredSales,
      filteredPurchases,
      filteredExpenses,
      totalSales,
      totalPurchases,
      totalExpenses,
      netProfit,
      ordersCount,
      financials,
      partnerSummary
    };
  }, [sales, purchases, expenses, customStartDate, customEndDate, customPaymentFilter, customSearchTerm, data?.salaryPayments, data?.partners, data?.partnerWithdrawals]);

  // ==========================================
  // 4. KITCHEN RECIPES & CONSUMPTION REPORT
  // ==========================================
  const [kitchenSubTab, setKitchenSubTab] = useState('stock'); // 'stock', 'product_consumption', 'invoice_consumption', 'recipe_costs'

  const kitchenData = useMemo(() => {
    const completedSales = sales.filter(s => s.status !== 'Cancelled');

    // 1. Current Raw Materials Stock Status & Valuation
    const stockReport = rawMaterials.map(rm => {
      const current = Number(rm.currentStock || 0);
      const min = Number(rm.minStock || 5);
      const cost = Number(rm.costPrice || 0);
      const totalValuation = current * cost;
      let status = 'Healthy';
      let statusVariant = 'success';
      if (current > 0 && current <= min) {
        status = 'Low Stock Alert';
        statusVariant = 'warning';
      }

      return {
        ...rm,
        currentStock: current,
        minStock: min,
        costPrice: cost,
        valuation: Number(totalValuation.toFixed(2)),
        status,
        statusVariant
      };
    });

    const totalKitchenStockValuation = stockReport.reduce((s, r) => s + r.valuation, 0);
    const lowStockIngredientsCount = stockReport.filter(r => r.currentStock <= r.minStock).length;

    // 2. Product-wise Consumption
    const productConsumptionMap = new Map();

    completedSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const pCode = String(item.productCode || item.code || item.id || '').trim();
        const pName = item.productName || item.name || 'Menu Dish';
        const qty = Number(item.quantity || 1);

        if (!productConsumptionMap.has(pCode)) {
          productConsumptionMap.set(pCode, {
            productCode: pCode,
            productName: pName,
            totalPortionsSold: 0,
            ingredients: new Map()
          });
        }

        const prodEntry = productConsumptionMap.get(pCode);
        prodEntry.totalPortionsSold += qty;

        const matchedRecipes = recipes.filter(r => 
          (pCode && String(r.productCode).trim() === pCode) ||
          String(r.productName || '').trim().toLowerCase() === pName.trim().toLowerCase()
        );

        matchedRecipes.forEach(ing => {
          const rmKey = String(ing.rawMaterialId);
          const rm = rawMaterials.find(m => String(m.id) === rmKey);
          const targetUnit = ing.unit || 'pcs';
          const singleServingQty = Number(ing.quantity || 0);
          const totalQty = singleServingQty * qty;

          if (!prodEntry.ingredients.has(rmKey)) {
            prodEntry.ingredients.set(rmKey, {
              rawMaterialId: rmKey,
              rawMaterialName: ing.rawMaterialName,
              totalQuantity: 0,
              unit: targetUnit,
              totalCost: 0
            });
          }

          const ingEntry = prodEntry.ingredients.get(rmKey);
          ingEntry.totalQuantity = Number((ingEntry.totalQuantity + totalQty).toFixed(4));
          const unitCost = rm ? calculateIngredientCost(totalQty, targetUnit, rm.costPrice, rm.unit) : 0;
          ingEntry.totalCost = Number((ingEntry.totalCost + unitCost).toFixed(2));
        });
      });
    });

    const productConsumptionList = Array.from(productConsumptionMap.values()).map(p => ({
      ...p,
      ingredientsList: Array.from(p.ingredients.values())
    }));

    // 3. Invoice-wise Consumption Audit
    const invoiceConsumptionList = completedSales.map(sale => {
      const consumedMap = new Map();
      (sale.items || []).forEach(item => {
        const pCode = String(item.productCode || item.code || item.id || '').trim();
        const pName = String(item.productName || item.name || '').trim().toLowerCase();
        const qty = Number(item.quantity || 1);

        const matchedRecipes = recipes.filter(r => 
          (pCode && String(r.productCode).trim() === pCode) ||
          String(r.productName || '').trim().toLowerCase() === pName
        );

        matchedRecipes.forEach(ing => {
          const rmKey = String(ing.rawMaterialId);
          const rm = rawMaterials.find(m => String(m.id) === rmKey);
          const targetUnit = ing.unit || 'pcs';
          const totalQty = Number(ing.quantity || 0) * qty;

          if (!consumedMap.has(rmKey)) {
            consumedMap.set(rmKey, {
              rawMaterialName: ing.rawMaterialName,
              quantity: 0,
              unit: targetUnit,
              cost: 0
            });
          }

          const entry = consumedMap.get(rmKey);
          entry.quantity = Number((entry.quantity + totalQty).toFixed(4));
          const cost = rm ? calculateIngredientCost(totalQty, targetUnit, rm.costPrice, rm.unit) : 0;
          entry.cost = Number((entry.cost + cost).toFixed(2));
        });
      });

      return {
        invoiceNumber: sale.invoiceNumber,
        date: sale.date,
        customerName: sale.customerName,
        totalAmount: sale.totalAmount,
        itemsSummary: (sale.items || []).map(i => `${i.quantity}x ${i.productName || i.name}`).join(', '),
        ingredients: Array.from(consumedMap.values()),
        totalIngredientCost: Array.from(consumedMap.values()).reduce((sum, i) => sum + i.cost, 0)
      };
    });

    // 4. Recipe Costing & Margin Report
    const recipeCostingList = products.map(prod => {
      const pCode = String(prod.code || prod.id || '').trim();
      const ingredients = recipes.filter(r => String(r.productCode).trim() === pCode);
      const hasRecipe = ingredients.length > 0;

      const totalCost = ingredients.reduce((sum, ing) => {
        const rm = rawMaterials.find(m => String(m.id) === String(ing.rawMaterialId));
        return sum + (rm ? calculateIngredientCost(ing.quantity, ing.unit, rm.costPrice, rm.unit) : Number(ing.totalCost || 0));
      }, 0);

      const price = Number(prod.sellingPrice || 0);
      const grossProfit = price - totalCost;
      const marginPct = price > 0 ? ((grossProfit / price) * 100).toFixed(1) : 0;
      const foodCostPct = price > 0 ? ((totalCost / price) * 100).toFixed(1) : 0;

      return {
        productCode: pCode,
        productName: prod.name,
        category: prod.category || 'Dishes',
        sellingPrice: price,
        recipeCost: Number(totalCost.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        marginPct: Number(marginPct),
        foodCostPct: Number(foodCostPct),
        ingredientsCount: ingredients.length,
        hasRecipe
      };
    });

    return {
      stockReport,
      totalKitchenStockValuation,
      lowStockIngredientsCount,
      productConsumptionList,
      invoiceConsumptionList,
      recipeCostingList
    };
  }, [sales, rawMaterials, products, recipes]);

  // ==========================================
  // PRINT & EXPORT HANDLERS
  // ==========================================
  const triggerPrintWindow = (title, periodSubtitle, metricsList, tablesHtml) => {
    const metricsHtml = metricsList.map(m => `
      <div style="flex: 1; min-width: 140px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">${m.label}</div>
        <div style="font-size: 18px; font-weight: 900; color: ${m.color || '#0f172a'}; margin-top: 4px;">${m.val}</div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} — ${appName}</title>
          <style>
            @page { margin: 15mm; size: auto; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 13px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .brand img { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; }
            .brand h1 { margin: 0; font-size: 20px; font-weight: 900; color: #1e293b; }
            .brand p { margin: 0; font-size: 11px; color: #64748b; }
            .meta { text-align: right; }
            .meta h2 { margin: 0; font-size: 16px; font-weight: 800; color: #4338ca; }
            .meta p { margin: 4px 0 0 0; font-size: 11px; color: #64748b; }
            .kpi-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
            .section-title { font-size: 14px; font-weight: 800; color: #1e293b; margin: 24px 0 10px 0; border-left: 4px solid #4f46e5; padding-left: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-weight: 800; color: #334155; border-bottom: 2px solid #cbd5e1; }
            td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 40px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <img src="${logo}" alt="" onerror="this.style.display='none'" />
              <div>
                <h1>${appName} Cloud Kitchen</h1>
                <p>POS & Financial Management System</p>
              </div>
            </div>
            <div class="meta">
              <h2>${title}</h2>
              <p>${periodSubtitle}</p>
            </div>
          </div>

          <div class="kpi-row">
            ${metricsHtml}
          </div>

          ${tablesHtml}

          <div class="footer">
            <span>Generated on: ${new Date().toLocaleString()}</span>
            <span>Authorized Signature: _________________________</span>
          </div>
        </body>
      </html>
    `;
    printHtml(html, { jobName: title, width: 950 }).catch(err => console.error('Print failed:', err));
  };

  // 1. Export Daily PDF
  const handleExportDailyPDF = () => {
    exportDailyReportPDF({
      dailyData,
      selectedDay,
      settings: data?.settings || {},
      currency
    });
  };

  // 1. Print Daily Report
  const handlePrintDailyReport = () => {
    const metrics = [
      { label: "Today's Sales", val: fmt(dailyData.totalSales), color: '#059669' },
      { label: 'Orders Count', val: `${dailyData.ordersCount} orders`, color: '#4f46e5' },
      { label: 'Costs & Expenses', val: fmt(dailyData.totalPurchases + dailyData.totalExpenses), color: '#e11d48' },
      { label: 'Net Profit', val: fmt(dailyData.netProfit), color: dailyData.netProfit >= 0 ? '#059669' : '#e11d48' }
    ];

    const paymentRows = Object.entries(dailyData.paymentMethods)
      .filter(([_, v]) => v.amount > 0 || v.count > 0)
      .map(([k, v]) => `
        <tr>
          <td><strong>${k}</strong></td>
          <td>${v.count} bills</td>
          <td style="font-weight: bold; color: #059669;">${fmt(v.amount)}</td>
        </tr>
      `).join('');

    const itemRows = dailyData.itemsSold.slice(0, 15).map(it => `
      <tr>
        <td><strong>${it.name}</strong></td>
        <td>${it.quantity}</td>
        <td style="font-weight: bold;">${it.revenue > 0 ? fmt(it.revenue) : '—'}</td>
      </tr>
    `).join('');

    const orderRows = dailyData.daySales.map(s => `
      <tr>
        <td><strong>${s.invoiceNumber}</strong></td>
        <td>${s.date ? new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        <td>${s.customerName || 'Walk-in'}</td>
        <td>${s.itemsSummary || (s.items || []).map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ')}</td>
        <td>${s.paymentMethod || 'Cash'}</td>
        <td style="font-weight: bold; text-align: right;">${fmt(s.totalAmount)}</td>
      </tr>
    `).join('');

    const tablesHtml = `
      <div style="display: flex; gap: 24px;">
        <div style="flex: 1;">
          <div class="section-title">Payment Breakdown</div>
          <table>
            <thead>
              <tr><th>Method</th><th>Orders</th><th>Amount</th></tr>
            </thead>
            <tbody>
              ${paymentRows || '<tr><td colspan="3">No sales recorded today</td></tr>'}
            </tbody>
          </table>
        </div>
        <div style="flex: 1;">
          <div class="section-title">Top Selling Items Today</div>
          <table>
            <thead>
              <tr><th>Item Name</th><th>Qty Sold</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${itemRows || '<tr><td colspan="3">No items sold today</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-title">Day's Invoiced Orders Ledger</div>
      <table>
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Time</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Payment</th>
            <th style="text-align: right;">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          ${orderRows || '<tr><td colspan="6" style="text-align: center;">No orders recorded for this day</td></tr>'}
        </tbody>
      </table>
    `;

    triggerPrintWindow('Daily Sales & Performance Report', `Date: ${selectedDay}`, metrics, tablesHtml);
  };

  // 2. Export Monthly PDF
  const handleExportMonthlyPDF = () => {
    exportMonthlyReportPDF({
      monthlyData,
      selectedMonth,
      settings: data?.settings || {},
      currency
    });
  };

  // 2. Print Monthly Report
  const handlePrintMonthlyReport = () => {
    const [y, m] = selectedMonth.split('-');
    const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    const metrics = [
      { label: 'Monthly Sales Revenue', val: fmt(monthlyData.totalSales), color: '#059669' },
      { label: 'Total Orders', val: `${monthlyData.ordersCount} orders`, color: '#4f46e5' },
      { label: 'Purchases & Restock', val: fmt(monthlyData.totalPurchases), color: '#d97706' },
      { label: 'Net Monthly Profit', val: fmt(monthlyData.netProfit), color: monthlyData.netProfit >= 0 ? '#059669' : '#e11d48' }
    ];

    const dayRows = monthlyData.dayLedger.filter(d => d.hasActivity).map(d => `
      <tr>
        <td><strong>${d.dateStr}</strong></td>
        <td>${d.ordersCount} orders</td>
        <td style="font-weight: bold; color: #059669;">${fmt(d.sales)}</td>
        <td style="color: #d97706;">${fmt(d.purchases)}</td>
        <td style="color: #e11d48;">${fmt(d.expenses)}</td>
        <td style="font-weight: bold; color: ${d.netProfit >= 0 ? '#059669' : '#e11d48'}; text-align: right;">${fmt(d.netProfit)}</td>
      </tr>
    `).join('');

    const topItemRows = monthlyData.topProducts.slice(0, 10).map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.quantity} portions</td>
        <td style="font-weight: bold; text-align: right;">${fmt(p.revenue)}</td>
      </tr>
    `).join('');

    const tablesHtml = `
      <div class="section-title">Day-by-Day Activity Ledger (${monthName})</div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Orders</th>
            <th>Sales</th>
            <th>Purchases</th>
            <th>Expenses</th>
            <th style="text-align: right;">Net Profit</th>
          </tr>
        </thead>
        <tbody>
          ${dayRows || '<tr><td colspan="6" style="text-align: center;">No activity recorded for this month</td></tr>'}
        </tbody>
      </table>

      <div class="section-title">Top 10 Selling Dishes of the Month</div>
      <table>
        <thead>
          <tr><th>Item Name</th><th>Units Sold</th><th style="text-align: right;">Revenue</th></tr>
        </thead>
        <tbody>
          ${topItemRows || '<tr><td colspan="3" style="text-align: center;">No menu sales logged this month</td></tr>'}
        </tbody>
      </table>
    `;

    triggerPrintWindow('Monthly Financial Statement', `Month: ${monthName}`, metrics, tablesHtml);
  };

  // 3. Export Custom PDF
  const handleExportCustomPDF = () => {
    exportCustomReportPDF({
      customData,
      customCategoryFilter,
      customStartDate,
      customEndDate,
      settings: data?.settings || {},
      currency
    });
  };

  // 3. Print Custom Report
  const handlePrintCustomReport = () => {
    const rangeLabel = `${customStartDate || 'All time'} to ${customEndDate || 'Present'}`;
    const metrics = [
      { label: 'Total Revenue', val: fmt(customData.totalSales), color: '#059669' },
      { label: 'Orders Count', val: `${customData.ordersCount} orders`, color: '#4f46e5' },
      { label: 'Total Purchases', val: fmt(customData.totalPurchases), color: '#d97706' },
      { label: 'Net Profit', val: fmt(customData.netProfit), color: customData.netProfit >= 0 ? '#059669' : '#e11d48' }
    ];

    const rows = customData.filteredSales.slice(0, 50).map(s => `
      <tr>
        <td><strong>${s.invoiceNumber}</strong></td>
        <td>${s.date ? new Date(s.date).toLocaleDateString('en-GB') : '—'}</td>
        <td>${s.customerName || 'Walk-in'}</td>
        <td>${s.itemsSummary || (s.items || []).map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ')}</td>
        <td>${s.paymentMethod || 'Cash'}</td>
        <td style="font-weight: bold; text-align: right;">${fmt(s.totalAmount)}</td>
      </tr>
    `).join('');

    const tablesHtml = `
      <div class="section-title">Filtered Orders Ledger</div>
      <table>
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Payment</th>
            <th style="text-align: right;">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" style="text-align: center;">No records matching filter</td></tr>'}
        </tbody>
      </table>
    `;

    triggerPrintWindow('Custom Financial Audit Report', `Range: ${rangeLabel}`, metrics, tablesHtml);
  };

  // Mobile Overview Quick Sums
  const mobileReceivables = (data?.customers || []).reduce((sum, c) => sum + Math.max(0, Number(c.outstandingBalance || 0)), 0);
  const mobilePayables = (data?.suppliers || []).reduce((sum, s) => sum + Math.max(0, Number(s.outstandingBalance || 0)), 0);

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-fadeIn pb-12">
      {/* Mobile-Only Quick Glance Strip */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        <button
          onClick={() => handleTabChange('customer-ledger')}
          className="p-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 text-left shadow-2xs active:scale-95 transition-all"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Receivables</span>
          <span className="text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5 block">{fmt(mobileReceivables)}</span>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5 flex items-center gap-0.5">
            Customer Ledger <ChevronRight className="w-3 h-3" />
          </span>
        </button>

        <button
          onClick={() => handleTabChange('supplier-ledger')}
          className="p-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 text-left shadow-2xs active:scale-95 transition-all"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payables</span>
          <span className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5 block">{fmt(mobilePayables)}</span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5 flex items-center gap-0.5">
            Vendor Ledger <ChevronRight className="w-3 h-3" />
          </span>
        </button>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <PieChart className="w-4 sm:w-5 h-4 sm:h-5 text-indigo-600 dark:text-indigo-400" />
            Financial & Sales Reports
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Daily closing, balance sheet, and individual partner/customer/vendor ledgers
          </p>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex overflow-x-auto no-scrollbar max-w-full bg-slate-100 dark:bg-neutral-900 p-1 rounded-xl border border-slate-200/80 dark:border-neutral-800 gap-1">
          <button
            onClick={() => handleTabChange('daily')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'daily'
                ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Daily</span>
          </button>

          <button
            onClick={() => handleTabChange('monthly')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'monthly'
                ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Monthly P&L</span>
          </button>

          <button
            onClick={() => handleTabChange('custom')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'custom'
                ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Custom Range</span>
          </button>

          <button
            onClick={() => handleTabChange('balance-sheet')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'balance-sheet'
                ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-2xs ring-1 ring-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-indigo-500" />
            <span>Balance Sheet</span>
          </button>

          <button
            onClick={() => handleTabChange('customer-ledger')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'customer-ledger'
                ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-2xs ring-1 ring-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            <span>Customer Ledger</span>
          </button>

          <button
            onClick={() => handleTabChange('supplier-ledger')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'supplier-ledger'
                ? 'bg-white dark:bg-neutral-800 text-amber-600 dark:text-amber-400 shadow-2xs ring-1 ring-amber-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-amber-500" />
            <span>Supplier Ledger</span>
          </button>

          <button
            onClick={() => handleTabChange('kitchen')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'kitchen'
                ? 'bg-white dark:bg-neutral-800 text-rose-600 dark:text-rose-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5 text-rose-500" />
            <span>Kitchen Analytics</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. DAILY REPORT VIEW                                      */}
      {/* ========================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          {/* Daily Date Selector Bar */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Day:
              </span>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-white"
              />
              <button
                onClick={() => setSelectedDay(todayStr)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                  selectedDay === todayStr
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => handleShiftDay(-1)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors"
              >
                Yesterday
              </button>
              <button
                onClick={() => handleShiftDay(1)}
                disabled={selectedDay >= todayStr}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next Day
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Printer}
                onClick={handlePrintDailyReport}
                className="text-xs h-7.5 px-2.5 py-1"
              >
                Print
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={handleExportDailyPDF}
                className="text-xs h-7.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Export PDF
              </Button>
            </div>
          </div>

          {/* Daily KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Sales Revenue */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Sales</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1">
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {fmt(dailyData.totalSales)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {dailyData.ordersCount} orders billed
                </p>
              </div>
            </div>

            {/* Restock & Expenses */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Costs & Restock</span>
                <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  <TrendingDown className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1">
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {fmt(dailyData.totalPurchases + dailyData.totalExpenses)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Purchases & expenses
                </p>
              </div>
            </div>

            {/* Net Daily Profit */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Profit</span>
                <span className={`p-1.5 rounded-lg ${dailyData.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'}`}>
                  <DollarSign className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1">
                <p className={`text-lg sm:text-xl font-black ${dailyData.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {fmt(dailyData.netProfit)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {dailyData.totalSales > 0 ? Math.round((dailyData.netProfit / dailyData.totalSales) * 100) : 0}% net margin
                </p>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Order Value</span>
                <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1">
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {fmt(dailyData.avgOrderValue)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  GST: {fmt(dailyData.totalTax)}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Breakdown & Items Sold Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Payment Method Distribution */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Payment Method Distribution</h4>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  Total: {fmt(dailyData.totalSales)}
                </span>
              </div>

              <div className="space-y-2">
                {['Cash', 'UPI', 'Card', 'Credit'].map(method => {
                  const m = dailyData.paymentMethods[method];
                  const pct = dailyData.totalSales > 0 ? Math.round((m.amount / dailyData.totalSales) * 100) : 0;
                  return (
                    <div key={method} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                          {method} ({m.count} bills)
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-semibold text-[10px]">{pct}%</span>
                          <span className="text-slate-900 dark:text-white font-black text-xs">{fmt(m.amount)}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-neutral-900 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Items Sold Today */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Dishes & Items Sold Today</h4>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  {dailyData.itemsSold.length} unique items
                </span>
              </div>

              {dailyData.itemsSold.length === 0 ? (
                <div className="py-4 text-center text-slate-400 text-xs font-semibold">
                  No menu items sold on this day yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-neutral-800/80 max-h-48 overflow-y-auto pr-1">
                  {dailyData.itemsSold.slice(0, 8).map((it, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-md bg-slate-100 dark:bg-neutral-900 text-[10px] font-black text-slate-500 flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{it.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-indigo-600 dark:text-indigo-400 block text-xs">{it.quantity} portions</span>
                        {it.revenue > 0 && <span className="text-[10px] text-slate-400 font-bold">{fmt(it.revenue)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Daily Invoiced Orders Table */}
          <Card
            title={`Day's Sales Ledger (${selectedDay})`}
            subtitle={`${dailyData.ordersCount} orders billed on this day`}
          >
            <Table
              columns={[
                {
                  header: 'Invoice #',
                  accessor: 'invoiceNumber',
                  render: (r) => <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.invoiceNumber}</span>
                },
                {
                  header: 'Time',
                  accessor: 'date',
                  render: (r) => r.date ? new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
                },
                {
                  header: 'Customer',
                  accessor: 'customerName',
                  render: (r) => r.customerName || 'Walk-in Customer'
                },
                {
                  header: 'Items',
                  accessor: 'itemsSummary',
                  render: (r) => (
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {r.itemsSummary || (r.items || []).map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ') || 'General Order'}
                    </span>
                  )
                },
                {
                  header: 'Payment Method',
                  accessor: 'paymentMethod',
                  render: (r) => <Badge variant="info">{r.paymentMethod || 'Cash'}</Badge>
                },
                {
                  header: 'Total Paid',
                  accessor: 'totalAmount',
                  render: (r) => <span className="font-black text-sm text-slate-900 dark:text-white">{fmt(r.totalAmount)}</span>
                }
              ]}
              data={dailyData.daySales}
              emptyMessage={`No orders billed on ${selectedDay}.`}
            />
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. MONTHLY REPORT VIEW                                    */}
      {/* ========================================================= */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          {/* Monthly Month Selector Bar */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-500" /> Month:
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-800 dark:text-white"
              />
              <button
                onClick={() => setSelectedMonth(currentMonthStr)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                  selectedMonth === currentMonthStr
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => {
                  const [y, m] = currentMonthStr.split('-').map(Number);
                  const prev = new Date(y, m - 2, 1);
                  setSelectedMonth(prev.toISOString().slice(0, 7));
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors"
              >
                Last Month
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Printer}
                onClick={handlePrintMonthlyReport}
                className="text-xs h-7.5 px-2.5 py-1"
              >
                Print
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={handleExportMonthlyPDF}
                className="text-xs h-7.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Export PDF
              </Button>
            </div>
          </div>

          {/* Monthly KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Monthly Sales */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monthly Sales</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1">
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {fmt(monthlyData.totalSales)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {monthlyData.ordersCount} orders billed
                </p>
              </div>
            </div>

            {/* Monthly Purchases */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Restock Purchases</span>
                <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Package className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1">
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {fmt(monthlyData.totalPurchases)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Ingredient restocks
                </p>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expenses & Overheads</span>
                <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  <TrendingDown className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1">
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {fmt(monthlyData.totalExpenses)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Utilities & supplies
                </p>
              </div>
            </div>

            {/* Net Monthly Profit */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Monthly Profit</span>
                <span className={`p-1.5 rounded-lg ${monthlyData.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'}`}>
                  <DollarSign className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1">
                <p className={`text-lg sm:text-xl font-black ${monthlyData.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {fmt(monthlyData.netProfit)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
                  Margin: {Math.round(monthlyData.profitMargin)}%
                </p>
              </div>
            </div>
          </div>

          {/* Partner Profit Allocation Breakdown */}
          {monthlyData.partnerSummary?.partners?.length > 0 && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-neutral-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400">
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                      Partner Profit Distribution ({selectedMonth})
                    </h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      Distributable: <span className="font-bold text-slate-900 dark:text-white">{fmt(monthlyData.partnerSummary.distributableProfit)}</span> • Labour Salaries: <span className="font-bold text-rose-500">{fmt(monthlyData.financials.labourSalaries)}</span>
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/partners')}
                  icon={HeartHandshake}
                  className="text-xs h-7 px-2.5 py-0.5 shrink-0"
                >
                  Partner Dashboard
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {monthlyData.partnerSummary.partners.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 sm:p-3 rounded-lg bg-slate-50 dark:bg-black border border-slate-200/80 dark:border-neutral-800 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">{p.name}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400">
                        {p.percentage}% Share
                      </span>
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs">
                      <div className="flex justify-between text-neutral-500 dark:text-neutral-400 text-[10px]">
                        <span>Profit Share:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(p.allocatedProfit)}</span>
                      </div>
                      <div className="flex justify-between text-neutral-500 dark:text-neutral-400 text-[10px]">
                        <span>Drawings:</span>
                        <span className="font-bold text-rose-500">{fmt(p.totalWithdrawals)}</span>
                      </div>
                      <div className="pt-1 border-t border-slate-200/60 dark:border-neutral-800 flex justify-between font-black text-[11px]">
                        <span className="text-slate-700 dark:text-neutral-300">Balance:</span>
                        <span className={p.remainingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                          {fmt(p.remainingBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day-by-Day Activity Ledger Table */}
          <Card
            title={`Daily Performance Breakdown — ${selectedMonth}`}
            subtitle="Click any row to jump to that day's detailed daily report"
          >
            <Table
              columns={[
                {
                  header: 'Date',
                  accessor: 'dateStr',
                  render: (r) => (
                    <button
                      onClick={() => {
                        setSelectedDay(r.dateStr);
                        setActiveTab('daily');
                      }}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>{r.dateStr}</span>
                      <ArrowRight className="w-3 h-3 opacity-60" />
                    </button>
                  )
                },
                {
                  header: 'Orders',
                  accessor: 'ordersCount',
                  render: (r) => <span className="font-bold text-xs">{r.ordersCount} orders</span>
                },
                {
                  header: 'Sales Revenue',
                  accessor: 'sales',
                  render: (r) => <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{fmt(r.sales)}</span>
                },
                {
                  header: 'Restock Purchases',
                  accessor: 'purchases',
                  render: (r) => <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{fmt(r.purchases)}</span>
                },
                {
                  header: 'Expenses',
                  accessor: 'expenses',
                  render: (r) => <span className="text-xs font-bold text-rose-500">{fmt(r.expenses)}</span>
                },
                {
                  header: 'Net Day Profit',
                  accessor: 'netProfit',
                  render: (r) => (
                    <span className={`font-black text-sm ${r.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                      {fmt(r.netProfit)}
                    </span>
                  )
                }
              ]}
              data={monthlyData.dayLedger.filter(d => d.hasActivity)}
              emptyMessage={`No financial activity logged for month ${selectedMonth}.`}
            />
          </Card>

          {/* Top Selling Products of the Month */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Top 10 Selling Dishes of the Month</h4>
              </div>
              <span className="text-xs font-bold text-slate-400">
                Sorted by units sold
              </span>
            </div>

            {monthlyData.topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No sales logged for this month.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {monthlyData.topProducts.slice(0, 10).map((p, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-sm text-indigo-600 dark:text-indigo-400 block">{p.quantity} portions</span>
                      {p.revenue > 0 && <span className="text-[10px] text-slate-400 font-bold">{fmt(p.revenue)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CUSTOMIZED REPORT VIEW                                 */}
      {/* ========================================================= */}
      {activeTab === 'custom' && (
        <div className="space-y-6">
          {/* Custom Date Range & Filters Panel */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600" />
                Custom Date Range & Filters
              </span>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: '30days', label: 'Last 30 Days' },
                  { id: 'thisMonth', label: 'This Month' },
                  { id: 'lastMonth', label: 'Last Month' },
                  { id: 'all', label: 'All Time' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* From Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                />
              </div>

              {/* Report Scope */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Report Scope</label>
                <select
                  value={customCategoryFilter}
                  onChange={(e) => setCustomCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                >
                  <option value="all">All Financials (Sales + Purchases)</option>
                  <option value="sales">Sales & Revenue Only</option>
                  <option value="purchases">Purchases & Restock Only</option>
                  <option value="expenses">Operating Expenses Only</option>
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Method</label>
                <select
                  value={customPaymentFilter}
                  onChange={(e) => setCustomPaymentFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                >
                  <option value="all">All Methods</option>
                  <option value="Cash">Cash Only</option>
                  <option value="UPI">UPI / Online Only</option>
                  <option value="Card">Card Only</option>
                  <option value="Credit">Credit Only</option>
                </select>
              </div>
            </div>

            {/* Search Input & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={customSearchTerm}
                  onChange={(e) => setCustomSearchTerm(e.target.value)}
                  placeholder="Filter by invoice #, customer, supplier name..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Printer}
                  onClick={handlePrintCustomReport}
                  className="text-xs"
                >
                  Print Report
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Download}
                  onClick={handleExportCustomPDF}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700"
                >
                  Export PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Custom Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Sales</span>
              <div className="mt-1">
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmt(customData.totalSales)}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{customData.ordersCount} orders</p>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Purchases</span>
              <div className="mt-1">
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmt(customData.totalPurchases)}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{customData.filteredPurchases.length} restock bills</p>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Expenses</span>
              <div className="mt-1">
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmt(customData.totalExpenses)}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{customData.filteredExpenses.length} expense logs</p>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Profit</span>
              <div className="mt-1">
                <p className={`text-lg sm:text-xl font-black ${customData.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {fmt(customData.netProfit)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
                  Margin: {customData.totalSales > 0 ? Math.round((customData.netProfit / customData.totalSales) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Partner Profit Allocation Breakdown (Custom Range) */}
          {customCategoryFilter === 'all' && customData.partnerSummary?.partners?.length > 0 && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-neutral-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400">
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                      Partner Profit Distribution (Filtered Range)
                    </h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      Distributable: <span className="font-bold text-slate-900 dark:text-white">{fmt(customData.partnerSummary.distributableProfit)}</span> • Labour Salaries: <span className="font-bold text-rose-500">{fmt(customData.financials.labourSalaries)}</span>
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/partners')}
                  icon={HeartHandshake}
                  className="text-xs h-7 px-2.5 py-0.5 shrink-0"
                >
                  Partner Dashboard
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {customData.partnerSummary.partners.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 sm:p-3 rounded-lg bg-slate-50 dark:bg-black border border-slate-200/80 dark:border-neutral-800 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">{p.name}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400">
                        {p.percentage}% Share
                      </span>
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs">
                      <div className="flex justify-between text-neutral-500 dark:text-neutral-400 text-[10px]">
                        <span>Profit Share:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(p.allocatedProfit)}</span>
                      </div>
                      <div className="flex justify-between text-neutral-500 dark:text-neutral-400 text-[10px]">
                        <span>Drawings:</span>
                        <span className="font-bold text-rose-500">{fmt(p.totalWithdrawals)}</span>
                      </div>
                      <div className="pt-1 border-t border-slate-200/60 dark:border-neutral-800 flex justify-between font-black text-[11px]">
                        <span className="text-slate-700 dark:text-neutral-300">Balance:</span>
                        <span className={p.remainingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                          {fmt(p.remainingBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filtered Data Table */}
          {customCategoryFilter === 'purchases' ? (
            <Card title="Purchases & Restock Ledger">
              <Table
                columns={[
                  { header: 'Purchase #', accessor: 'materialNumber', render: (r) => <span className="font-bold text-indigo-600">{r.materialNumber || r.id}</span> },
                  { header: 'Date', accessor: 'date', render: (r) => r.date },
                  { header: 'Supplier', accessor: 'supplierName', render: (r) => r.supplierName },
                  { header: 'Status', accessor: 'paymentStatus', render: (r) => <Badge variant="info">{r.paymentStatus || 'Paid'}</Badge> },
                  { header: 'Payment Method', accessor: 'paymentMethod', render: (r) => r.paymentMethod || 'Cash' },
                  { header: 'Total Cost', accessor: 'totalAmount', render: (r) => <span className="font-black text-rose-600">{fmt(r.totalAmount)}</span> }
                ]}
                data={customData.filteredPurchases}
                emptyMessage="No purchases match your custom filter."
              />
            </Card>
          ) : customCategoryFilter === 'expenses' ? (
            <Card title="Operating Expenses Ledger">
              <Table
                columns={[
                  { header: 'ID', accessor: 'id', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
                  { header: 'Date', accessor: 'date', render: (r) => r.date },
                  { header: 'Category', accessor: 'category', render: (r) => <Badge variant="warning">{r.category}</Badge> },
                  { header: 'Payment Method', accessor: 'paymentMethod', render: (r) => r.paymentMethod },
                  { header: 'Description', accessor: 'description', render: (r) => r.description || '—' },
                  { header: 'Amount', accessor: 'amount', render: (r) => <span className="font-black text-rose-600">{fmt(r.amount)}</span> }
                ]}
                data={customData.filteredExpenses}
                emptyMessage="No expenses match your custom filter."
              />
            </Card>
          ) : (
            <Card title="Sales & Orders Ledger">
              <Table
                columns={[
                  { header: 'Invoice #', accessor: 'invoiceNumber', render: (r) => <span className="font-mono font-bold text-indigo-600">{r.invoiceNumber}</span> },
                  { header: 'Date', accessor: 'date', render: (r) => r.date ? new Date(r.date).toLocaleDateString('en-GB') : '—' },
                  { header: 'Customer', accessor: 'customerName', render: (r) => r.customerName || 'Walk-in Customer' },
                  { header: 'Items Summary', accessor: 'itemsSummary', render: (r) => <span className="text-xs text-slate-600 dark:text-slate-300">{r.itemsSummary || (r.items || []).map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ') || '—'}</span> },
                  { header: 'Payment Method', accessor: 'paymentMethod', render: (r) => <Badge variant="info">{r.paymentMethod || 'Cash'}</Badge> },
                  { header: 'Total Paid', accessor: 'totalAmount', render: (r) => <span className="font-black text-sm text-slate-900 dark:text-white">{fmt(r.totalAmount)}</span> }
                ]}
                data={customData.filteredSales}
                emptyMessage="No sales match your custom filter."
              />
            </Card>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. KITCHEN RECIPES & CONSUMPTION REPORT VIEW              */}
      {/* ========================================================= */}
      {activeTab === 'kitchen' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Kitchen Metrics Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kitchen Stock Valuation</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {fmt(kitchenData.totalKitchenStockValuation)}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">{kitchenData.stockReport.length} raw ingredients</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Low-Stock Alerts</span>
              <span className={`text-xl sm:text-2xl font-black mt-1 block ${kitchenData.lowStockIngredientsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {kitchenData.lowStockIngredientsCount} Items
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Below reorder alert level</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recipes Configured</span>
              <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
                {kitchenData.recipeCostingList.filter(r => r.hasRecipe).length} / {kitchenData.recipeCostingList.length}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Menu snacks with BOM</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Orders</span>
              <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                {kitchenData.invoiceConsumptionList.length} Invoices
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Tracked for consumption</span>
            </div>
          </div>

          {/* Sub-Tabs Toolbar & Search */}
          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none py-0.5">
              {[
                { id: 'stock', label: 'Raw Materials Stock & Alerts', count: kitchenData.stockReport.length },
                { id: 'product_consumption', label: 'Dish-Wise Consumption', count: kitchenData.productConsumptionList.length },
                { id: 'invoice_consumption', label: 'Invoice-Wise Consumption', count: kitchenData.invoiceConsumptionList.length },
                { id: 'recipe_costs', label: 'Recipe Costs & Margins', count: kitchenData.recipeCostingList.length }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setKitchenSubTab(sub.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    kitchenSubTab === sub.id
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sub.label} ({sub.count})
                </button>
              ))}
            </div>

            {/* Export PDF for active view */}
            <Button
              size="sm"
              variant="outline"
              icon={Download}
              onClick={() => {
                exportKitchenReportPDF({
                  kitchenData,
                  kitchenSubTab,
                  settings: data?.settings || {},
                  currency
                });
              }}
              className="text-xs shrink-0 border-slate-200 dark:border-slate-700"
            >
              Export PDF
            </Button>
          </div>

          {/* Sub-Tab 1: Raw Materials Stock & Alerts */}
          {kitchenSubTab === 'stock' && (
            <Card title="Raw Material Stock & Alerts">
              <Table
                columns={[
                  { header: 'ID', accessor: 'id', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
                  { header: 'Material Name', accessor: 'name', render: (r) => <span className="font-extrabold text-xs text-slate-900 dark:text-white">{r.name}</span> },
                  { header: 'Category', accessor: 'category', render: (r) => <Badge variant="warning">{r.category || 'General'}</Badge> },
                  {
                    header: 'Current Stock',
                    accessor: 'currentStock',
                    render: (r) => (
                      <span className={`font-black text-sm ${r.currentStock <= r.minStock ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {r.currentStock} {r.unit}
                      </span>
                    )
                  },
                  { header: 'Cost / Unit', accessor: 'costPrice', render: (r) => <span className="font-bold text-xs">{fmt(r.costPrice)} / {r.unit}</span> },
                  { header: 'Stock Valuation', accessor: 'valuation', render: (r) => <span className="font-black text-xs text-emerald-600">{fmt(r.valuation)}</span> },
                  { header: 'Min Alert', accessor: 'minStock', render: (r) => <span className="text-xs text-slate-400">{r.minStock} {r.unit}</span> },
                  {
                    header: 'Stock Status',
                    accessor: 'status',
                    render: (r) => <Badge variant={r.statusVariant}>{r.status}</Badge>
                  }
                ]}
                data={kitchenData.stockReport}
                emptyMessage="No raw materials registered in kitchen inventory."
              />
            </Card>
          )}

          {/* Sub-Tab 2: Product-Wise Ingredient Consumption */}
          {kitchenSubTab === 'product_consumption' && (
            <Card title="Dish-Wise Ingredient Consumption">
              <Table
                columns={[
                  { header: 'Code', accessor: 'productCode', render: (r) => <span className="font-mono text-xs font-bold text-indigo-600">{r.productCode || '—'}</span> },
                  { header: 'Dish / Snack', accessor: 'productName', render: (r) => <span className="font-extrabold text-xs text-slate-900 dark:text-white">{r.productName}</span> },
                  { header: 'Portions Sold', accessor: 'totalPortionsSold', render: (r) => <Badge variant="info">{r.totalPortionsSold} Portions</Badge> },
                  {
                    header: 'Raw Materials Consumed (BOM Breakdown)',
                    accessor: 'ingredientsList',
                    render: (r) => (
                      <div className="flex flex-wrap gap-1.5 py-1">
                        {r.ingredientsList.length > 0 ? (
                          r.ingredientsList.map((ing, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-800 dark:text-slate-200">
                              <strong>{ing.totalQuantity} {ing.unit}</strong> {ing.rawMaterialName} ({fmt(ing.totalCost)})
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No recipe linked to dish</span>
                        )}
                      </div>
                    )
                  },
                  {
                    header: 'Total Ingredient Cost',
                    accessor: 'totalCost',
                    render: (r) => {
                      const cost = r.ingredientsList.reduce((sum, i) => sum + i.totalCost, 0);
                      return <span className="font-black text-xs text-rose-600">{fmt(cost)}</span>;
                    }
                  }
                ]}
                data={kitchenData.productConsumptionList}
                emptyMessage="No dish consumption recorded yet. Complete POS orders to see ingredient consumption."
              />
            </Card>
          )}

          {/* Sub-Tab 3: Invoice-Wise Consumption Audit */}
          {kitchenSubTab === 'invoice_consumption' && (
            <Card title="Invoice Consumption Audit">
              <Table
                columns={[
                  { header: 'Invoice #', accessor: 'invoiceNumber', render: (r) => <span className="font-mono font-bold text-indigo-600">{r.invoiceNumber}</span> },
                  { header: 'Date', accessor: 'date', render: (r) => r.date ? new Date(r.date).toLocaleString('en-GB') : '—' },
                  { header: 'Customer', accessor: 'customerName', render: (r) => r.customerName || 'Walk-in Customer' },
                  { header: 'Dishes Prepared', accessor: 'itemsSummary', render: (r) => <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{r.itemsSummary}</span> },
                  {
                    header: 'Raw Materials Deducted',
                    accessor: 'ingredients',
                    render: (r) => (
                      <div className="flex flex-wrap gap-1 py-1">
                        {r.ingredients.length > 0 ? (
                          r.ingredients.map((ing, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[10px] font-bold">
                              {ing.quantity} {ing.unit} {ing.rawMaterialName}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No recipe ingredients deducted</span>
                        )}
                      </div>
                    )
                  },
                  { header: 'Prep Cost', accessor: 'totalIngredientCost', render: (r) => <span className="font-black text-xs text-rose-600">{fmt(r.totalIngredientCost)}</span> },
                  { header: 'Invoice Paid', accessor: 'totalAmount', render: (r) => <span className="font-black text-xs text-slate-900 dark:text-white">{fmt(r.totalAmount)}</span> }
                ]}
                data={kitchenData.invoiceConsumptionList}
                emptyMessage="No invoice consumption logged yet."
              />
            </Card>
          )}

          {/* Sub-Tab 4: Recipe Costs & Margins */}
          {kitchenSubTab === 'recipe_costs' && (
            <Card title="Recipe Costing & Profit Margins">
              <Table
                columns={[
                  { header: 'Code', accessor: 'productCode', render: (r) => <span className="font-mono text-xs">{r.productCode}</span> },
                  { header: 'Dish / Snack', accessor: 'productName', render: (r) => <span className="font-extrabold text-xs text-slate-900 dark:text-white">{r.productName}</span> },
                  { header: 'Category', accessor: 'category', render: (r) => <Badge variant="warning">{r.category}</Badge> },
                  { header: 'Selling Price', accessor: 'sellingPrice', render: (r) => <span className="font-black text-xs text-slate-900 dark:text-white">{fmt(r.sellingPrice)}</span> },
                  { header: 'Recipe Cost', accessor: 'recipeCost', render: (r) => <span className="font-black text-xs text-rose-600">{fmt(r.recipeCost)}</span> },
                  { header: 'Gross Profit', accessor: 'grossProfit', render: (r) => <span className="font-black text-xs text-emerald-600">{fmt(r.grossProfit)}</span> },
                  {
                    header: 'Margin %',
                    accessor: 'marginPct',
                    render: (r) => (
                      <span className={`font-black text-xs ${r.marginPct >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {r.hasRecipe ? `${r.marginPct}%` : '—'}
                      </span>
                    )
                  },
                  {
                    header: 'Food Cost %',
                    accessor: 'foodCostPct',
                    render: (r) => (
                      <span className="font-bold text-xs text-slate-600 dark:text-slate-400">
                        {r.hasRecipe ? `${r.foodCostPct}%` : '—'}
                      </span>
                    )
                  },
                  {
                    header: 'BOM Status',
                    accessor: 'hasRecipe',
                    render: (r) => (
                      <Badge variant={r.hasRecipe ? 'success' : 'warning'}>
                        {r.hasRecipe ? `Active (${r.ingredientsCount} Ing.)` : 'No Recipe'}
                      </Badge>
                    )
                  }
                ]}
                data={kitchenData.recipeCostingList}
                emptyMessage="No menu products registered."
              />
            </Card>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. BALANCE SHEET VIEW                                     */}
      {/* ========================================================= */}
      {activeTab === 'balance-sheet' && (
        <div className="space-y-6">
          <BalanceSheetReport />
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. CUSTOMER LEDGER VIEW                                   */}
      {/* ========================================================= */}
      {activeTab === 'customer-ledger' && (
        <div className="space-y-6">
          <CustomerLedgerReport initialCustomerId={initialCustomerId} />
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. SUPPLIER LEDGER VIEW                                   */}
      {/* ========================================================= */}
      {activeTab === 'supplier-ledger' && (
        <div className="space-y-6">
          <SupplierLedgerReport initialSupplierId={initialSupplierId} />
        </div>
      )}
    </div>
  );
};
