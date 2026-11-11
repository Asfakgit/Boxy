export const Card = ({ title, subtitle, icon: Icon, action, children, className = '', noPadding = false }) => {
  return (
    <div className={`glass-card rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-black shadow-xs hover:shadow-sm transition-all duration-200 overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 border-b border-slate-100 dark:border-neutral-800/60">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100/50 dark:border-neutral-800">
                <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
              </div>
            )}
            <div>
              {title && <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h3>}
              {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-3.5 sm:p-4'}>
        {children}
      </div>
    </div>
  );
};
