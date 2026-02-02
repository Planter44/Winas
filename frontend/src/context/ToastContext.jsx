import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message, options = {}) => {
    const id = nextId.current++;
    const type = options.type || 'info';
    const duration = typeof options.duration === 'number' ? options.duration : 3500;

    setToasts(prev => [...prev, { id, type, message }]);

    if (duration > 0) {
      window.setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  const api = useMemo(() => ({
    show,
    success: (message, options) => show(message, { ...options, type: 'success' }),
    error: (message, options) => show(message, { ...options, type: 'error' }),
    info: (message, options) => show(message, { ...options, type: 'info' }),
    remove: removeToast
  }), [removeToast, show]);

  const getToastClasses = (type) => {
    if (type === 'success') return 'bg-emerald-600 text-white';
    if (type === 'error') return 'bg-red-600 text-white';
    return 'bg-gray-900 text-white';
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md space-y-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`shadow-lg rounded-lg px-4 py-3 flex items-start justify-between gap-3 ${getToastClasses(t.type)}`}
            role="status"
            aria-live="polite"
          >
            <div className="text-sm font-medium leading-snug">{t.message}</div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-white/80 hover:text-white text-sm font-bold px-2"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
