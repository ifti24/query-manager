import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface SessionTimeoutConfig {
  idleTimeoutMinutes: number;
  warningSeconds: number;
}

export function useSessionTimeout(config: SessionTimeoutConfig, onTimeout: () => void) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    setSecondsRemaining(config.warningSeconds);
    setShowWarning(true);

    countdownRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearAllTimers();
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [config.warningSeconds, onTimeout, clearAllTimers]);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    lastActivityRef.current = Date.now();

    const idleTimeoutMs = config.idleTimeoutMinutes * 60 * 1000;
    const warningTimeMs = config.warningSeconds * 1000;

    warningTimeoutRef.current = setTimeout(() => {
      startCountdown();
    }, idleTimeoutMs - warningTimeMs);

    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, idleTimeoutMs);
  }, [config.idleTimeoutMinutes, config.warningSeconds, onTimeout, clearAllTimers, startCountdown]);

  const keepAlive = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    const handleActivity = () => {
      if (!showWarning) {
        resetTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    resetTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [resetTimer, clearAllTimers, showWarning]);

  return {
    showWarning,
    secondsRemaining,
    keepAlive,
  };
}
