export const dynamic = "force-dynamic";

import AdmissionCompassPageClient from './AdmissionCompassPageClient';

export const metadata = {
  title: 'Colleges | MockMob',
  description: 'Which DU programmes your CUET subjects open, and the published 2026 cutoffs college by college.',
};

export default function AdmissionCompassPage() {
  return <AdmissionCompassPageClient />;
}
