import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const TOAST_DURATION = 4500;

const config: Record<ToastType, { bar: string; bg: string; border: string; icon: React.ReactNode; titleColor: string; msgColor: string }> = {
  success: {
    bar: 'bg-green-500',
    bg: 'bg-white',
    border: 'border-green-200',
    icon: <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />,
    titleColor: 'text-slate-900',
    msgColor: 'text-slate-500',
  },
  error: {
    bar: 'bg-red-500',
    bg: 'bg-white',
    border: 'border-red-200',
    icon: <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />,
    titleColor: 'text-slate-900',
    msgColor: 'text-slate-500',
  },
  warning: {
    bar: 'bg-amber-400',
    bg: 'bg-white',
    border: 'border-amber-200',
    icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
    titleColor: 'text-slate-900',
    msgColor: 'text-slate-500',
  },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const c = config[toast.type];

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 10);
    const leaveTimer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onDismiss(toast.id), 350);
    }, TOAST_DURATION);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(leaveTimer);
    };
  }, [toast.id, onDismiss]);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 350);
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl shadow-lg border ${c.border} ${c.bg}
        w-80 transition-all duration-350 ease-in-out
        ${visible && !leaving ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      <div className={`h-1 w-full ${c.bar}`} />
      <div className="flex items-start gap-3 px-4 py-3.5">
        {c.icon}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${c.titleColor}`}>{toast.title}</p>
          {toast.message && (
            <p className={`text-xs mt-0.5 leading-relaxed ${c.msgColor}`}>{toast.message}</p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="shrink-0 p-0.5 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 items-end">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
