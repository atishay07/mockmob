"use client";

// Ask Mobi on Today (owner LK143, 5 Nov 2026: "one of our main features ... completely gone from the UI"): one row right under the lead
// card, the whole surface the door, as Road to CUET and the Repairs tiles are (F5). It opens his own page, the two doors: any CUET doubt,
// or what your papers say. The line says what each costs before the press (standards 11: AI costs stated before the call). No volt:
// the lead card's key stays the screen's one (D7). Static art, like the rail's door.
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import mascot from '@/../public/brand/mascot/manifest.json';
import { useMentorHref } from '@/components/nav/YouPlaces';

export const TODAY_ASK_COPY = Object.freeze({
  name: 'Ask Mobi',
  line: 'Any CUET doubt, or what your papers say. Answers from your record are free; a written reply is 1 credit.',
});

// It needs no read, so it is drawn from the first paint and never arrives late to push the sections under it (W-042).
export default function TodayAsk() {
  const href = useMentorHref();
  return (
    <Link href={href} className="tmask" data-tour="today-ask">
      <Image className="tmask__face" src={mascot.greeting.src} width={34} height={46} sizes="34px" alt="" />
      <span className="tmask__text"><b>{TODAY_ASK_COPY.name}</b><span>{TODAY_ASK_COPY.line}</span></span>
      <ChevronRight className="tmask__go" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
