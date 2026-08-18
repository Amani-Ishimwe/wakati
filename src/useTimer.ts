import { useState, useEffect, useRef, useCallback } from 'react';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'warning' | 'urgent' | 'overtime';

interface UseTimerProps {
  initialDuration: number; // in seconds
  overtimeEnabled: boolean;
  onWarning: (type: 'warning' | 'urgent') => void;
  onExpire: () => void;
  onTick: () => void;
}

const workerCode = `
  let timerId = null;
  self.onmessage = function(e) {
    if (e.data === 'start') {
      if (timerId) clearInterval(timerId);
      timerId = setInterval(() => {
        self.postMessage('tick');
      }, 100);
    } else if (e.data === 'stop') {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }
  };
`;

export const useTimer = ({
  initialDuration,
  overtimeEnabled,
  onWarning,
  onExpire,
  onTick,
}: UseTimerProps) => {
  const [duration, setDurationState] = useState<number>(initialDuration);
  const [timeLeft, setTimeLeft] = useState<number>(initialDuration);
  const [status, setStatus] = useState<TimerStatus>('idle');

  // References for keeping state in callbacks without re-triggering effects
  const statusRef = useRef<TimerStatus>('idle');
  const durationRef = useRef<number>(initialDuration);
  const overtimeEnabledRef = useRef<boolean>(overtimeEnabled);

  // Time tracking references
  const targetTimeRef = useRef<number | null>(null);
  const pausedTimeRemainingRef = useRef<number | null>(null);
  
  // Audio warning triggers to ensure they only fire once
  const warnedTwoMinRef = useRef<boolean>(false);
  const warnedThirtySecRef = useRef<boolean>(false);
  const expiredRef = useRef<boolean>(false);

  const workerRef = useRef<Worker | null>(null);

  // Sync references
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    overtimeEnabledRef.current = overtimeEnabled;
  }, [overtimeEnabled]);

  // Handle a timer tick
  const handleTick = useCallback(() => {
    if (statusRef.current !== 'running' && statusRef.current !== 'warning' && statusRef.current !== 'urgent' && statusRef.current !== 'overtime') {
      return;
    }

    const now = Date.now();
    const target = targetTimeRef.current || now;
    const diffMs = target - now;
    const secondsRemaining = Math.ceil(diffMs / 1000);

    // Callback on every tick (for tick sound)
    onTick();

    if (diffMs > 0) {
      setTimeLeft(secondsRemaining);
      
      // Determine status
      let newStatus: TimerStatus = 'running';
      if (secondsRemaining <= 30) {
        newStatus = 'urgent';
        if (!warnedThirtySecRef.current) {
          warnedThirtySecRef.current = true;
          onWarning('urgent');
        }
      } else if (secondsRemaining <= 120) {
        newStatus = 'warning';
        if (!warnedTwoMinRef.current) {
          warnedTwoMinRef.current = true;
          onWarning('warning');
        }
      }

      if (newStatus !== statusRef.current) {
        statusRef.current = newStatus;
        setStatus(newStatus);
      }
    } else {
      // Time is expired (<= 0)
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }

      if (overtimeEnabledRef.current) {
        statusRef.current = 'overtime';
        setStatus('overtime');
        // Negative count-up timer values
        const elapsedSeconds = Math.floor(Math.abs(diffMs) / 1000);
        setTimeLeft(-elapsedSeconds);
      } else {
        // Stop timer
        statusRef.current = 'idle';
        setStatus('idle');
        setTimeLeft(0);
        if (workerRef.current) {
          workerRef.current.postMessage('stop');
        }
      }
    }
  }, [onWarning, onExpire, onTick]);

  // Setup Web Worker
  useEffect(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const blobURL = URL.createObjectURL(blob);
    const worker = new Worker(blobURL);
    
    worker.onmessage = (e) => {
      if (e.data === 'tick') {
        handleTick();
      }
    };
    
    workerRef.current = worker;

    return () => {
      worker.terminate();
      URL.revokeObjectURL(blobURL);
    };
  }, [handleTick]);

  // Start the timer
  const start = useCallback(() => {
    if (statusRef.current === 'running' || statusRef.current === 'warning' || statusRef.current === 'urgent' || statusRef.current === 'overtime') {
      return;
    }

    const now = Date.now();
    
    // Reset flags if starting from scratch
    if (statusRef.current === 'idle') {
      warnedTwoMinRef.current = false;
      warnedThirtySecRef.current = false;
      expiredRef.current = false;
      
      const currentDuration = durationRef.current;
      targetTimeRef.current = now + currentDuration * 1000;
      setTimeLeft(currentDuration);
    } else if (statusRef.current === 'paused' && pausedTimeRemainingRef.current !== null) {
      // Resume from paused
      targetTimeRef.current = now + pausedTimeRemainingRef.current;
    }

    // Determine status
    const initialDiff = (targetTimeRef.current || now) - now;
    const initialSecs = Math.ceil(initialDiff / 1000);
    let initialStatus: TimerStatus = 'running';
    if (initialSecs <= 30 && initialSecs > 0) {
      initialStatus = 'urgent';
    } else if (initialSecs <= 120 && initialSecs > 0) {
      initialStatus = 'warning';
    } else if (initialSecs <= 0 && overtimeEnabledRef.current) {
      initialStatus = 'overtime';
    }

    statusRef.current = initialStatus;
    setStatus(initialStatus);

    if (workerRef.current) {
      workerRef.current.postMessage('start');
    }
  }, []);

  // Pause the timer
  const pause = useCallback(() => {
    if (statusRef.current === 'idle' || statusRef.current === 'paused') {
      return;
    }

    if (workerRef.current) {
      workerRef.current.postMessage('stop');
    }

    if (targetTimeRef.current !== null) {
      pausedTimeRemainingRef.current = targetTimeRef.current - Date.now();
    }

    statusRef.current = 'paused';
    setStatus('paused');
  }, []);

  // Reset the timer
  const reset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage('stop');
    }

    targetTimeRef.current = null;
    pausedTimeRemainingRef.current = null;
    warnedTwoMinRef.current = false;
    warnedThirtySecRef.current = false;
    expiredRef.current = false;
    
    const currentDuration = durationRef.current;
    statusRef.current = 'idle';
    setStatus('idle');
    setTimeLeft(currentDuration);
  }, []);

  // Set duration manually
  const setDuration = useCallback((seconds: number) => {
    // Only allow setting duration in idle or paused states
    if (statusRef.current !== 'idle' && statusRef.current !== 'paused') {
      // Force reset first if timer is running
      if (workerRef.current) {
        workerRef.current.postMessage('stop');
      }
      targetTimeRef.current = null;
      pausedTimeRemainingRef.current = null;
      warnedTwoMinRef.current = false;
      warnedThirtySecRef.current = false;
      expiredRef.current = false;
      statusRef.current = 'idle';
      setStatus('idle');
    }
    
    setDurationState(seconds);
    setTimeLeft(seconds);
    
    // If we're paused, resetting keeps it paused but changes the time
    if (statusRef.current === 'paused') {
      pausedTimeRemainingRef.current = seconds * 1000;
    }
  }, []);

  return {
    timeLeft,
    duration,
    status,
    start,
    pause,
    reset,
    setDuration,
  };
};
