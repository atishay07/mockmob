import { notFound } from 'next/navigation';
import Prototypes from './Prototypes';
export const metadata = { robots: { index: false, follow: false } };
export default async function PrototypePage({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const query = await searchParams;
  return <Prototypes initial={Math.max(0, Math.min(2, (Number(query.v) || 1) - 1))} />;
}
