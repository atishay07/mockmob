"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

function getRemainingParts(targetTime) {
  const remainingMs = Math.max(0, targetTime - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);

  return {
    totalSeconds,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function PriceIncreaseCountdown({ deadline }) {
  const targetTime = useMemo(() => new Date(deadline).getTime(), [deadline]);
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    const tick = () => setRemaining(getRemainingParts(targetTime));

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [targetTime]);

  const isExpired = remaining?.totalSeconds === 0;

  return (
    <div className="price-countdown-panel mx-auto mt-6 max-w-3xl" aria-live="polite">
      <div className="price-countdown-copy">
        <div className="price-countdown-kicker">
          <Clock3 className="h-4 w-4" />
          Price increase tomorrow, 12:00 AM IST
        </div>
        <p>
          Lock MockMob Pro at <strong>Rs 69/month</strong> before the midnight pricing update goes live.
        </p>
      </div>
      <div className="price-countdown-timer" aria-label="Time left before price increase">
        {isExpired ? (
          <span className="price-countdown-live">New pricing is live</span>
        ) : remaining ? (
          <>
            <span>
              <strong>{pad(remaining.hours)}</strong>
              <em>hrs</em>
            </span>
            <span>
              <strong>{pad(remaining.minutes)}</strong>
              <em>min</em>
            </span>
            <span>
              <strong>{pad(remaining.seconds)}</strong>
              <em>sec</em>
            </span>
          </>
        ) : (
          <span className="price-countdown-live">Counting to midnight</span>
        )}
      </div>
    </div>
  );
}
