import { useEffect } from 'react';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, subtitle, children, maxWidth = 'max-w-lg', footer }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className={`relative w-full ${maxWidth} bg-white dark:bg-black rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden max-h-[92vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/50">
          <div className="min-w-0 pr-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1">
          {children}
        </div>

        {footer && (
          <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-slate-50/80 dark:bg-neutral-950/80 border-t border-slate-100 dark:border-neutral-800 flex justify-end gap-2 sm:gap-2.5 flex-wrap">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
