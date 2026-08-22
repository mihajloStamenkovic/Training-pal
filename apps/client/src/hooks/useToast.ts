import { createContext, useContext } from 'react';

export interface ToastApi {
  /** Surfaces a failure to the user. Replaces alert() — non-blocking. */
  showError: (message: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
}
