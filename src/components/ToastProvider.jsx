"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Link from 'next/link';

const ToastContext = createContext(null);

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((type, message) => {
    const id = uid();
    const payload = typeof message === 'string' ? { message } : message;
    setToasts((current) => [...current, { id, type, ...payload }]);
    window.setTimeout(() => dismissToast(id), 3200);
  }, [dismissToast]);

  const value = useMemo(() => ({
    success: (message) => pushToast('success', message),
    error: (message) => pushToast('error', message),
  }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-4 bottom-4 z-[120] flex flex-col gap-2 md:left-auto md:right-4 md:max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`glass px-4 py-3 text-sm ${toast.type === 'success' ? 'volt-soft text-volt' : 'text-red-300'}`}
            style={toast.type === 'error' ? { borderColor: 'rgba(248,113,113,0.22)', background: 'rgba(248,113,113,0.08)' } : undefined}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{toast.message}</span>
              {toast.href && (
                <Link href={toast.href} className="font-bold underline underline-offset-4">
                  {toast.actionLabel || 'Open'}
                </Link>
              )}
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: 0, color: 'inherit' }}
                onClick={() => dismissToast(toast.id)}
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return context;
}
