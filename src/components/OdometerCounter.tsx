import React, { useEffect, useState, useRef } from 'react';
import { playOdometerTick } from '../lib/audio';

interface OdometerCounterProps {
  targetValue: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  currency?: boolean;
  className?: string;
  onComplete?: () => void;
  autoStart?: boolean;
  decimals?: number;
}

export const OdometerCounter: React.FC<OdometerCounterProps> = ({
  targetValue,
  duration = 1200,
  prefix = '',
  suffix = '',
  currency = true,
  className = '',
  onComplete,
  autoStart = true,
  decimals = 2,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const completeAnimation = () => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }
    setDisplayValue(targetValue);
    setIsCompleted(true);
    if (onComplete && !isCompleted) {
      onComplete();
    }
  };

  useEffect(() => {
    if (!autoStart || targetValue <= 0) {
      setDisplayValue(targetValue);
      setIsCompleted(true);
      if (targetValue <= 0 && onComplete) {
        onComplete();
      }
      return;
    }

    setIsCompleted(false);
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);
      
      // Cubic ease-out for satisfying speed & deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = targetValue * eased;

      setDisplayValue(current);

      if (progress < 1) {
        if (Math.floor(current * 4) % 3 === 0) {
          playOdometerTick();
        }
        animRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(targetValue);
        setIsCompleted(true);
        if (onComplete) {
          onComplete();
        }
      }
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [targetValue, duration, autoStart]);

  const formattedNumber = currency
    ? displayValue.toLocaleString('en-PH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : displayValue.toFixed(decimals);

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={completeAnimation}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          completeAnimation();
        }
      }}
      title={!isCompleted ? 'Click to skip counting' : undefined}
      className={`inline-block cursor-pointer select-none transition-transform hover:scale-105 active:scale-95 ${className}`}
    >
      {prefix}
      {formattedNumber}
      {suffix}
    </span>
  );
};
