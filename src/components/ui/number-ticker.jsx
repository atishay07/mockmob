"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCountUpState } from "@/lib/motion/useCountUp";
import { recallNumber } from "@/lib/motion/numberMemory";
import { useInView } from "@/lib/motion/useInView";
import { useMobiPrefs } from "@/lib/mobiPrefs";

/**
 * A number that rolls. It starts rolling when it scrolls into view, rolls from whatever it was
 * showing when `value` changes, and shows the real value at once under Reduce motion. Screen
 * readers always get the real value, never the numbers in between.
 *   direction="down" counts from `value` to `startValue` instead.
 *   memoryKey remembers the value in this visit (the app's number memory): the same value shows at once, a
 *   changed one rolls from the old figure and is tinted while it moves (see useCountUpState).
 */
export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  memoryKey,
  ...props
}) {
  const { reduced } = useMobiPrefs();
  const [ref, inView] = useInView({ once: true });
  const [go, setGo] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0 || !inView) return undefined;
    const timer = setTimeout(() => setGo(true), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay, inView]);

  const down = direction === "down";
  // Seen before in this visit: wait at the remembered figure, not at the start, so a return never climbs from 0.
  const remembered = memoryKey != null ? recallNumber(memoryKey) : undefined;
  const resting = remembered !== undefined ? remembered : (down ? value : startValue);
  const target = (inView && go) || reduced ? (down ? startValue : value) : resting;
  // Memory starts with the real value: the 'before it scrolls in' start value must never be remembered.
  const started = (inView && go) || reduced;
  const { value: rolled, ink } = useCountUpState(target, { decimals: decimalPlaces, memoryKey: started ? memoryKey : undefined });
  const text = Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number(rolled));
  const real = Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number(down ? startValue : value));

  return (
    <span ref={ref} className={cn("inline-block tracking-wider tabular-nums text-inherit", memoryKey != null && "mk-num", className)} data-ink={ink || undefined} {...props}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{real}</span>
    </span>
  );
}
