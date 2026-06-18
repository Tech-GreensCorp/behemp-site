'use client';

import { useEffect, useState, useRef } from 'react';

interface CounterProps {
  target: number;
  duration?: number; // duration in ms
  suffix?: string;
}

export function Counter({ target, duration = 4000, suffix = '' }: CounterProps) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const animatedRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animatedRef.current) {
          animatedRef.current = true;
          let startTimestamp: number | null = null;
          const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            // Ease-out quad formula
            const easedProgress = progress * (2 - progress);
            const val = Math.floor(easedProgress * target);
            setCount(val);
            if (progress < 1) {
              window.requestAnimationFrame(step);
            } else {
              setCount(target);
            }
          };
          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [target, duration]);

  // Format numbers nicely: e.g. 8000 -> 8.000
  const formattedCount = count.toLocaleString('pt-BR');

  return (
    <span ref={elementRef}>
      {formattedCount}
      {suffix}
    </span>
  );
}
