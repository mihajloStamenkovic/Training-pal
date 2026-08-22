import { useState, useEffect, useRef, useCallback } from 'react';

interface UseRestTimerReturn {
  remaining: number;
  /** What the timer was started with — the ring's denominator. */
  total: number;
  isActive: boolean;
  start: (durationSeconds: number) => void;
  /** Pushes the end time out without restarting the countdown. */
  extend: (seconds: number) => void;
  cancel: () => void;
}

export function useRestTimer(onComplete?: () => void): UseRestTimerReturn {
  const [endTime, setEndTime] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const rafRef = useRef(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const start = useCallback((durationSeconds: number) => {
    const end = Date.now() + durationSeconds * 1000;
    setEndTime(end);
    setRemaining(durationSeconds);
    setTotal(durationSeconds);
    setIsActive(true);
  }, []);

  const extend = useCallback((seconds: number) => {
    setEndTime((prev) => (prev === null ? prev : prev + seconds * 1000));
    setTotal((prev) => prev + seconds);
  }, []);

  const cancel = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setEndTime(null);
    setIsActive(false);
    setRemaining(0);
  }, []);

  // RAF loop for live countdown
  useEffect(() => {
    if (!endTime) return;

    const tick = () => {
      const now = Date.now();
      const rem = Math.max(0, Math.ceil((endTime - now) / 1000));
      setRemaining(rem);

      if (rem <= 0) {
        setIsActive(false);
        setEndTime(null);
        onCompleteRef.current?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [endTime]);

  // Visibility API: re-sync when screen wakes
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && endTime) {
        const now = Date.now();
        const rem = Math.max(0, Math.ceil((endTime - now) / 1000));
        setRemaining(rem);
        if (rem <= 0) {
          setIsActive(false);
          setEndTime(null);
          onCompleteRef.current?.();
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [endTime]);

  return { remaining, total, isActive, start, extend, cancel };
}
