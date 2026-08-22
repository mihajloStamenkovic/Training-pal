import { useEffect } from 'react';

/** Escape closes any overlay. Shared by the dialog and the bottom sheet. */
export function useDismissOnEscape(onDismiss: () => void) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onDismiss]);
}
