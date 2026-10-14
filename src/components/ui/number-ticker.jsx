"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/lib/motion/useCountUp";
import { useInView } from "@/lib/motion/useInView";
import { useMobiPrefs } from "@/lib/mobiPrefs";

/**
 * A number that rolls. It starts rolling when it scrolls into view, rolls from whatever it was
 * showing when `value` changes, and shows the real value at once under Reduce motion. Screen
 * readers always get the real value, never the numbers in between.
 *   direction="down" counts from `value` to `startValue` instead.
 */
export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
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
  const target = (inView && go) || reduced ? (down ? startValue : value) : (down ? value : startValue);
  const rolled = useCountUp(target, { decimals: decimalPlaces, duration: 1400 });
  const text = Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number(rolled));
  const real = Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number(down ? startValue : value));

  return (
    <span ref={ref} className={cn("inline-block tracking-wider tabular-nums text-inherit", className)} {...props}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{real}</span>
    </span>
  );
}
