"use client";

// Night, Daylight or Match device, in the Arena menu where it is easy to find. The same three choices
// as Account > Appearance and the same stored value, so the two always agree. A choice applies at once
// and is remembered on this device. Arrow keys move between the three.
import { useRef } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { setThemeMode, useDeviceThemeSync, useThemeMode } from '@/components/ThemeToggle';

const CHOICES = [
  { id: 'dark', name: 'Night', Icon: Moon },
  { id: 'light', name: 'Daylight', Icon: Sun },
  { id: 'system', name: 'Match device', Icon: Monitor },
];

export default function AppearanceSwitch({ className = '' }) {
  const mode = useThemeMode();
  useDeviceThemeSync();
  const refs = useRef([]);
  const current = Math.max(0, CHOICES.findIndex((c) => c.id === mode));

  const pick = (id, element) => { if (id !== mode) setThemeMode(id, element); };
  const onKey = (event, index) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + CHOICES.length) % CHOICES.length;
    refs.current[next]?.focus();
    pick(CHOICES[next].id, refs.current[next]);
  };

  return (
    <div className={`arena-appearance ${className}`.trim()} role="radiogroup" aria-label="Appearance">
      {CHOICES.map(({ id, name, Icon }, index) => (
        <button
          key={id}
          ref={(node) => { refs.current[index] = node; }}
          type="button"
          role="radio"
          aria-checked={mode === id}
          tabIndex={index === current ? 0 : -1}
          onClick={(event) => pick(id, event.currentTarget)}
          onKeyDown={(event) => onKey(event, index)}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>{name}</span>
        </button>
      ))}
    </div>
  );
}
