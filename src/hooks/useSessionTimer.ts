
import { useState, useRef, useEffect } from 'react';

interface UseSessionTimerProps {
  duration: number; // Duration in seconds
  onComplete: () => void;
  isActive: boolean;
}

export const useSessionTimer = ({ duration, onComplete, isActive }: UseSessionTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, isRunning, onComplete]);

  const startTimer = () => {
    setIsRunning(true);
  };

  const stopTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeRemaining(duration);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timeRemaining,
    isRunning,
    startTimer,
    stopTimer,
    resetTimer,
    formatTime: () => formatTime(timeRemaining),
    progress: ((duration - timeRemaining) / duration) * 100
  };
};
