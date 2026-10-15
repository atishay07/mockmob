"use client";

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PUBLIC_SUBJECTS, subjectArt } from '@/../data/subject_art.mjs';
import { BRAND_FLAGS, brandFlags } from '@/../data/brand_flags.mjs';
import { useLiveStats } from './useLiveStats';

// All 15 CUET subjects (web IA plan 4.2, section 3). A subject links to its hub where one exists.
// Question counts come from the live /api/stats only; while it loads or when it fails, the count is
// left out, never invented. With brand_flags.subjectArt on, each tile carries the app's photo-real
// object, whole (never cropped), with its contact shadow under the object's foot.
function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
}

function Art({ id, name, showArt }) {
  const art = showArt ? subjectArt(id) : null;
  if (!art) return <span className="lp-subj__mark" aria-hidden="true">{initials(name)}</span>;
  return (
    <span className="lp-subj__art" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.src} width={art.width} height={art.height} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

// Development only: /?brand=art shows the objects for the Gate A look without flipping the flag.
const noSubscribe = () => () => {};
const previewParam = () => (process.env.NODE_ENV === 'production' ? null : new URLSearchParams(window.location.search).get('brand'));
function usePreviewArt(initial) {
  const param = useSyncExternalStore(noSubscribe, previewParam, () => null);
  return param ? brandFlags(param).subjectArt : initial;
}

export function SubjectGrid({ showArt: initialArt = BRAND_FLAGS.subjectArt } = {}) {
  const { subjectCounts } = useLiveStats();
  const showArt = usePreviewArt(initialArt);
  return (
    <ul className="lp-subjects" data-art={showArt ? 'true' : 'false'}>
      {PUBLIC_SUBJECTS.map((s) => {
        const n = subjectCounts ? subjectCounts[s.id] : null;
        const count = Number.isFinite(n) && n > 0 ? `${n.toLocaleString('en-IN')} questions` : null;
        const body = (
          <>
            <Art id={s.id} name={s.name} showArt={showArt} />
            <span className="lp-subj__name">{s.name}</span>
            {count ? <span className="lp-subj__count mm-measure">{count}</span> : null}
            {s.hub ? <ArrowUpRight size={16} aria-hidden="true" className="lp-subj__go" /> : null}
          </>
        );
        return (
          <li key={s.id}>
            {s.hub ? <Link href={s.hub} className="lp-subj lp-subj--link">{body}</Link> : <div className="lp-subj">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
