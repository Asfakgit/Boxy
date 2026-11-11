import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  ShoppingBag,
  TrendingUp,
  Truck,
  AlertTriangle,
  RefreshCw,
  Plus,
  ArrowRight,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export const Dashboard = () => {
  const { metrics, data, refreshData, isSyncing } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const currency = data?.settings?.currencySymbol || '₹';
  const appLogo = data?.settings?.logo || '/logo.jpg';

  const fmt = (num) => `${currency} ${Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Today's Live Date
  const todayStr = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Calculate live numbers for today
  const todayOrders = (data?.sales || []).filter(s => String(s.date).startsWith(todayStr));
  const todaySalesAmount = todayOrders.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

  const todayPurchasesAmount = (data?.purchases || [])
    .filter(p => String(p.date).startsWith(todayStr))
    .reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

  const todayExpensesAmount = (data?.expenses || [])
    .filter(e => String(e.date).startsWith(todayStr))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const todayCosts = todayPurchasesAmount + todayExpensesAmount;
  const todayNetProfit = todaySalesAmount - todayCosts;

  // Low stock count
  const lowStockCount = Number(metrics?.lowStockCount || 0);

  // 7-Day Sales Trend Chart Data
  const calculateWeeklyChart = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return {
        date: d.toISOString().split('T')[0],
        day: days[d.getDay()],
        sales: 0
      };
    }).reverse();

    const chartMap = new Map(last7Days.map(d => [d.date, d]));

    (data?.sales || []).forEach(sale => {
      const d = sale.date?.split('T')[0];
      if (chartMap.has(d)) {
        chartMap.get(d).sales += Number(sale.totalAmount || 0);
      }
    });

    return Array.from(chartMap.values());
  };

  const chartData = calculateWeeklyChart();
  const recentOrders = (data?.sales || []).slice(0, 5);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Welcome & Quick Action Header */}
      <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={appLogo}
            alt="Boxy Logo"
            className="w-10 h-10 rounded-xl object-cover ring-2 ring-amber-400/50 shadow-md shadow-amber-500/20 shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
              {data?.settings?.companyName || 'Boxy Cloud Kitchen'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>{todayFormatted}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            icon={RefreshCw}
            isLoading={isSyncing}
            onClick={() => refreshData()}
            className="text-xs h-7.5 px-2.5 py-1"
          >
            {isSyncing ? 'Syncing...' : 'Sync Data'}
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={Plus}
            onClick={() => navigate('/pos')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 h-7.5 px-3 py-1"
          >
            New Sale (POS)
          </Button>
        </div>
      </div>

      {/* 2. Low Stock Alert (Only shown if items are low) */}
      {lowStockCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{lowStockCount} items</strong> are running low on stock.
            </span>
          </div>
          <button
            onClick={() => navigate('/items')}
            className="font-bold underline text-amber-700 dark:text-amber-300 hover:text-amber-800 shrink-0 ml-2"
          >
            View Stock &rarr;
          </button>
        </div>
      )}

      {/* 3. The 4 Simple Numbers (Easy to Understand at a glance) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Today's Sales */}
        <div 
          onClick={() => navigate('/orders')}
          className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:border-indigo-400 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today's Sales</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {fmt(todaySalesAmount)}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {todayOrders.length} {todayOrders.length === 1 ? 'order' : 'orders'} today
            </p>
          </div>
        </div>

        {/* Today's Expenses */}
        <div 
          onClick={() => navigate('/purchases')}
          className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:border-amber-400 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today's Costs</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Truck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {fmt(todayCosts)}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Purchases & expenses
            </p>
          </div>
        </div>

        {/* Today's Net Profit */}
        <div 
          onClick={() => navigate('/transactions')}
          className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:border-emerald-400 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today's Profit</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h3 className={`text-lg sm:text-xl font-black ${todayNetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
              {todayNetProfit >= 0 ? '+' : ''}{fmt(todayNetProfit)}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Sales minus today's costs
            </p>
          </div>
        </div>

        {/* Inventory Stock Status */}
        <div 
          onClick={() => navigate('/items')}
          className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:border-purple-400 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock Status</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              lowStockCount > 0 
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600' 
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
            }`}>
              {lowStockCount > 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {lowStockCount > 0 ? `${lowStockCount} Low` : 'All Good'}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {lowStockCount > 0 ? 'Below reorder level' : 'Stock levels healthy'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Clean Weekly Sales Trend & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Weekly Sales Chart (7 Cols) */}
        <div className="lg:col-span-7">
          <Card
            title="Weekly Sales"
            subtitle="Total sales revenue for the past 7 days"
          >
            <div className="h-64 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradientSimple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#000000', borderColor: '#262626', borderRadius: '12px', fontSize: '12px', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                    formatter={(val) => [fmt(val), 'Sales']}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="Daily Sales"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#salesGradientSimple)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Recent Orders (5 Cols) */}
        <div className="lg:col-span-5">
          <Card
            title="Recent Orders"
            subtitle="Latest completed customer sales"
            action={
              <button
                onClick={() => navigate('/orders')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>All Orders</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="space-y-2.5">
              {recentOrders.map((order, idx) => (
                <div
                  key={order.invoiceNumber || idx}
                  onClick={() => navigate('/orders')}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white truncate">
                        {order.customerName || 'Walk-in Customer'}
                      </span>
                      <Badge variant={order.paymentMethod === 'Credit' ? 'warning' : 'default'} className="text-[10px] py-0 px-1.5">
                        {order.paymentMethod || 'Cash'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                      #{order.invoiceNumber} • {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="font-black text-sm text-slate-900 dark:text-white shrink-0">
                    {fmt(order.totalAmount)}
                  </span>
                </div>
              ))}

              {recentOrders.length === 0 && (
                <div className="py-8 text-center text-slate-400">
                  <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs font-medium">No sales recorded yet today.</p>
                  <button
                    onClick={() => navigate('/pos')}
                    className="text-xs text-indigo-600 font-bold mt-1 underline"
                  >
                    Start a sale in POS
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
