"use client";
// The daily time the student already holds, read once: the account's number when the server holds one, else the one this
// device kept, else none. Used by screens that show the picker without the goal page's own read (Learn's preferences).
import { useEffect, useState } from 'react';
import { api } from '@/lib/fetcher';
import { pickMinutes } from '@/lib/goalMinutes.mjs';
import { promoteDeviceMinutes, readDeviceMinutes } from '@/lib/goalMinutesStore';

export function useHeldMinutes() {
  const [held, setHeld] = useState({ minutes: null, source: null, ready: false });
  useEffect(() => {
    let alive = true;
    api('/api/me/goal')
      .then((body) => {
        if (!alive) return;
        setHeld({ ...pickMinutes(body?.dailyMinutes, readDeviceMinutes()), ready: true });
        promoteDeviceMinutes(body).then((promoted) => { if (alive && promoted !== null) setHeld({ minutes: promoted, source: 'account', ready: true }); });
      })
      .catch(() => { if (alive) setHeld({ ...pickMinutes(null, readDeviceMinutes()), ready: true }); });
    return () => { alive = false; };
  }, []);
  return held;
}
