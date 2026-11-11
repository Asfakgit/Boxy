import { useState, useEffect } from 'react';
import { Trash2, Edit3, X } from 'lucide-react';
import { Button } from './Button';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  itemName,
  confirmText,
  cancelText = 'Cancel',
  type = 'delete' // 'delete', 'update', 'danger', 'info'
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) onClose();
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
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      if (onConfirm) await onConfirm();
    } catch (e) {
      console.error('Confirmation action error:', e);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  const isDelete = type === 'delete' || type === 'danger';
  const defaultConfirmText = isDelete ? 'Yes, Delete' : 'Yes, Update';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleIn flex flex-col text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Badge */}
        <div className="mx-auto mb-4">
          {isDelete ? (
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center ring-8 ring-rose-500/10 shadow-xs">
              <Trash2 className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-8 ring-indigo-500/10 shadow-xs">
              <Edit3 className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
          {title}
        </h3>

        {/* Highlighted Item Badge (if provided) */}
        {itemName && (
          <div className="my-2.5 inline-flex items-center justify-center">
            <span className="px-3.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate max-w-xs shadow-2xs">
              {itemName}
            </span>
          </div>
        )}

        {/* Message */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6 leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl text-xs font-bold"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={isDelete ? 'danger' : 'primary'}
            onClick={handleConfirm}
            isLoading={isSubmitting}
            className={`w-full py-2.5 rounded-xl text-xs font-black shadow-xs ${
              isDelete
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {confirmText || defaultConfirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

