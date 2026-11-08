"use client";

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

// The free plan as one quiet line under the plan card (R3-D8: "the Free plan as a quiet line with Sign up free"). A guest gets the
// Sign up free key; a signed-in student is already on a plan, so the line keeps only its facts (L-007: no sign-up for someone in).
export function PlanFree({ line, cta }) {
  const { isAuthenticated } = useAuth();
  return (
    <p className="lp-plan__free">
      <span>{line}</span>
      {isAuthenticated ? null : <Link href="/signup" className="lp-plan__freekey">{cta}</Link>}
    </p>
  );
}

export default PlanFree;
