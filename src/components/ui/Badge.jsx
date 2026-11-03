export const Badge = ({ children, variant = 'default', className = '' }) => {
  const getStyle = () => {
    const text = String(children || '').toLowerCase();
    
    if (variant !== 'default') {
      const explicitStyles = {
        success: {
          wrap: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80',
          dot: 'bg-emerald-500'
        },
        danger: {
          wrap: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80',
          dot: 'bg-rose-500'
        },
        warning: {
          wrap: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80',
          dot: 'bg-amber-500'
        },
        info: {
          wrap: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80',
          dot: 'bg-indigo-500'
        },
      };
      return explicitStyles[variant] || explicitStyles.info;
    }

    if (text.includes('active') || text.includes('paid') || text.includes('completed') || text.includes('success') || text.includes('in stock')) {
      return {
        wrap: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80',
        dot: 'bg-emerald-500'
      };
    }
    if (text.includes('low') || text.includes('due') || text.includes('danger') || text.includes('error')) {
      return {
        wrap: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80',
        dot: 'bg-rose-500'
      };
    }
    if (text.includes('partial') || text.includes('pending') || text.includes('warning')) {
      return {
        wrap: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80',
        dot: 'bg-amber-500'
      };
    }
    if (text.includes('credit') || text.includes('card') || text.includes('upi') || text.includes('bank')) {
      return {
        wrap: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80',
        dot: 'bg-indigo-500'
      };
    }

    return {
      wrap: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400'
    };
  };

  const style = getStyle();

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${style.wrap} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`}></span>
      <span>{children}</span>
    </span>
  );
};
