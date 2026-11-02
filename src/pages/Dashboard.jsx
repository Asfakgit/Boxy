import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
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
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Truck,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  RefreshCw,
  Plus,
  ArrowRight
} from 'lucide-react';

export const Dashboard = () => {
  const { metrics, data, refreshData, isSyncing } = useApp();
  const navigate = useNavigate();
  const currency = data?.settings?.currencySymbol || '₹';

  const fmt = (num) => `${currency} ${Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Calculate 7-day sales and purchases trend
  const calculateChartData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return {
        date: d.toISOString().split('T')[0],
        day: days[d.getDay()],
        sales: 0,
        purchases: 0
      };
    }).reverse();

    const chartDataMap = new Map(last7Days.map(d => [d.date, d]));

    (data?.sales || []).forEach(sale => {
      const date = sale.date?.split('T')[0];
      if (chartDataMap.has(date)) {
        const entry = chartDataMap.get(date);
        entry.sales += Number(sale.totalAmount || 0);
      }
    });

    (data?.purchases || []).forEach(purchase => {
      const date = purchase.date?.split('T')[0];
      if (chartDataMap.has(date)) {
        const entry = chartDataMap.get(date);
        entry.purchases += Number(purchase.totalAmount || 0);
      }
    });

    return Array.from(chartDataMap.values());
  };

  const chartData = calculateChartData();
  const recentTransactions = (data?.transactions || []).slice(0, 6);

  const kpis = [
    {
      title: "Today's Sales",
      val: fmt(metrics.todaySales || 0),
      subtitle: `${(data?.sales || []).filter(s => String(s.date).startsWith(new Date().toISOString().split('T')[0])).length} orders today`,
      icon: ShoppingBag,
      color: 'from-indigo-600 to-indigo-700',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600'
    },
    {
      title: "Today's Purchases",
      val: fmt(metrics.todayPurchases || 0),
      subtitle: `Raw material restocking`,
      icon: Truck,
      color: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600'
    },
    {
      title: "Net Operating Margin",
      val: fmt(metrics.netProfit || 0),
      subtitle: `Overall net profit`,
      icon: TrendingUp,
      color: 'from-emerald-600 to-teal-600',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
    },
    {
      title: "Receivables Due",
      val: fmt(metrics.outstandingReceivables || 0),
      subtitle: `From ${(data?.customers || []).filter(c => Number(c.outstandingBalance || 0) > 0).length} B2B accounts`,
      icon: DollarSign,
      color: 'from-violet-600 to-purple-600',
      iconBg: 'bg-violet-50 dark:bg-violet-950/60 text-violet-600'
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Welcome Action Bar */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <img
            src="/logo.jpg"
            alt="Boxy Kitchen Logo"
            className="w-13 h-13 rounded-2xl object-cover ring-2 ring-amber-400/50 shadow-md shadow-amber-500/20"
          />
          <div>
            <h2 className="text-xl font-black">{data?.settings?.companyName || 'Boxy Cloud Kitchen'}</h2>
            <p className="text-xs text-indigo-200">
              Kitchen Operations Hub • {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={RefreshCw}
            isLoading={isSyncing}
            onClick={() => refreshData()}
            className="border-white/20 text-white hover:bg-white/10 text-xs"
          >
            Sync Database
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={Plus}
            onClick={() => navigate('/pos')}
            className="bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-md"
          >
            New Sale (POS)
          </Button>
        </div>
      </div>

      {/* Low Stock Warning Pill */}
      {metrics.lowStockCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span><strong>{metrics.lowStockCount} items</strong> are below safe stock thresholds.</span>
          </div>
          <button onClick={() => navigate('/items')} className="font-bold underline text-amber-700 dark:text-amber-300">
            View Stock List &rarr;
          </button>
        </div>
      )}

      {/* 1-Click Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/pos')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-indigo-500 hover:shadow-xs transition-all flex items-center gap-3 group text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-extrabold text-xs text-slate-900 dark:text-white block">POS Billing</h5>
            <span className="text-[10px] text-slate-400">Take customer order</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/items')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-purple-500 hover:shadow-xs transition-all flex items-center gap-3 group text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-extrabold text-xs text-slate-900 dark:text-white block">Live Stock</h5>
            <span className="text-[10px] text-slate-400">Inventory counts</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/purchases')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-amber-500 hover:shadow-xs transition-all flex items-center gap-3 group text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-extrabold text-xs text-slate-900 dark:text-white block">Restock Items</h5>
            <span className="text-[10px] text-slate-400">Vendor purchase</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/transactions')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all flex items-center gap-3 group text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-extrabold text-xs text-slate-900 dark:text-white block">Cash Flow</h5>
            <span className="text-[10px] text-slate-400">Record expense</span>
          </div>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="glass-card rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">{kpi.title}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{kpi.val}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{kpi.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart & Live Activity Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 7-Day Revenue Trend Chart (8 Cols) */}
        <div className="lg:col-span-8">
          <Card
            title="7-Day Financial Performance"
            subtitle="Daily POS Sales Revenue vs Raw Material Restocking Costs"
          >
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="purchasesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                    formatter={(val) => [fmt(val), '']}
                  />
                  <Area type="monotone" dataKey="sales" name="Sales Revenue" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
                  <Area type="monotone" dataKey="purchases" name="Purchases Cost" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#purchasesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Live Transactions Feed (4 Cols) */}
        <div className="lg:col-span-4">
          <Card
            title="Recent Activity"
            subtitle="Live entries from Transactions sheet"
            action={
              <button
                onClick={() => navigate('/transactions')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="space-y-3">
              {recentTransactions.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      tx.flow === 'IN' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600' 
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600'
                    }`}>
                      {tx.flow === 'IN' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{tx.partyName || tx.referenceId}</p>
                      <p className="text-[10px] text-slate-400">{tx.type} • {tx.paymentMethod}</p>
                    </div>
                  </div>
                  <span className={`font-black ${tx.flow === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.flow === 'IN' ? '+' : '-'}{fmt(tx.amount)}
                  </span>
                </div>
              ))}

              {recentTransactions.length === 0 && (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs font-medium">No recent transactions.</p>
                  <button onClick={() => navigate('/pos')} className="text-xs text-indigo-600 font-bold mt-1 underline">
                    Record your first sale in POS
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
