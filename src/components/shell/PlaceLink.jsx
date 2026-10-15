"use client";

// One of the four places (Today, Practice, Review, You) in the sidebar, rail or phone bar.
// Icon and label always together, never icon only (plan 2.1). The label keeps its weight in every
// state, so changing places never shifts the text; only colour and the lens change (DOCK.md 3.1).
import Link from 'next/link';
import { House, FileQuestionMark, ListChecks, UserRound } from 'lucide-react';
import { placeSpoken } from './shellModel.mjs';

const ICONS = { today: House, practice: FileQuestionMark, review: ListChecks };

export function PlaceIcon({ id, initial = '', size = 22 }) {
  if (id === 'you') {
    return <span className="sh-avatar" aria-hidden="true">{initial || <UserRound size={Math.round(size * 0.68)} strokeWidth={2} />}</span>;
  }
  const Icon = ICONS[id] || House;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}

export default function PlaceLink({ place, href, active = false, badge = null, badgeCount = null, variant = 'sidebar', initial = '', onNavigate }) {
  const spoken = placeSpoken(place.id, badgeCount);
  return (
    <Link
      href={href}
      className={`sh-place sh-place--${variant}`}
      aria-current={active ? 'page' : undefined}
      aria-label={spoken !== place.label ? spoken : undefined}
      data-tour={`nav-${place.id}`}
      data-place={place.id}
      onClick={onNavigate}
    >
      <span className="sh-place__icon">
        <PlaceIcon id={place.id} initial={initial} size={variant === 'sidebar' ? 19 : 22} />
        {badge ? <span className="sh-badge" aria-hidden="true">{badge}</span> : null}
      </span>
      <span className="sh-place__label">{place.label}</span>
    </Link>
  );
}
