import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2.5rem)]"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm ${
            t.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : t.type === 'info'
              ? 'bg-white border-[#E6EAF2] text-[#0F0D2E]'
              : 'bg-[#0F0D2E] border-[#1E1B4B] text-white'
          }`}
        >
          {t.type === 'error' ? (
            <AlertCircle size={17} className="text-red-600 shrink-0" />
          ) : t.type === 'info' ? (
            <Info size={17} className="text-[#1E1B4B] shrink-0" />
          ) : (
            <CheckCircle2 size={17} className="text-[#E11D48] shrink-0" />
          )}
          <span className="flex-1 leading-snug">{t.text}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss notification"
            className="opacity-65 hover:opacity-100 p-0.5"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
