import { notFound } from 'next/navigation';
import SocialWallPreview from './SocialWallPreview';
import '../../landing.css';
import '../../social-proof.css';

export const metadata = { robots: { index: false, follow: false } };

export default async function WallPrototype({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const count = params?.count;
  const initialFixture = ['0', '1', '3', '4', 'many'].includes(count) ? count : '4';
  return <SocialWallPreview initialFixture={initialFixture} />;
}
