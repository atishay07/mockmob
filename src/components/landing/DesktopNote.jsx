"use client";
import { useEffect, useState } from 'react';
import { Monitor, X } from 'lucide-react';

const seen = 'mm:desktop-note:v1';

export function DesktopNote() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia('(max-width: 699px)').matches) return;
    try {
      if (localStorage.getItem(seen)) return;
      localStorage.setItem(seen, '1');
    } catch { return; }
    setOpen(true);
  }, []);
  return open ? (
    <aside className="lp-desktop-note" aria-label="Device tip">
      <Monitor size={17} aria-hidden="true" />
      <span>MockMob works best on a laptop or desktop.</span>
      <button type="button" aria-label="Dismiss device tip" onClick={() => setOpen(false)}><X size={15} aria-hidden="true" /></button>
    </aside>
  ) : null;
}
