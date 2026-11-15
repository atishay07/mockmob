"use client";
// Practice's way to the Sunday Mock: one quiet chip under the head, every day, opening the Sunday Mock page (where the subject is
// chosen). It says when the next paper is open, or that it is open now. Off, signed out, no subjects or a failed read: nothing.
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { practiceLine } from '@/lib/sundayMock.mjs';
import { useSunday } from './useSunday';
import './sunday.css';

export default function SundayPracticeRow() {
  const sunday = useSunday(true);
  const row = sunday.status === 'ready' ? practiceLine(sunday.data) : null;
  if (!row) return null;
  return (
    <Link className="sun-chip" href="/sunday">
      <CalendarClock size={17} strokeWidth={1.75} aria-hidden="true" />
      <span><b>{row.title}</b> {row.line}</span>
    </Link>
  );
}
