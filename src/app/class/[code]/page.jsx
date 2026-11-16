import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import ClassJoin from '@/components/class/ClassJoin';
import { DEFAULT_SHARE_IMAGE, absoluteUrl, siteConfig } from '@/lib/seo';
import { classLeaguesEnabled } from '@/lib/classLeague/flag.mjs';

// /class/<code>: a class league's public join page (src/components/class/ClassJoin.jsx). Behind CLASS_LEAGUES_ENABLED: off,
// the page does not exist. Never indexed. Its link preview says what a class league is, with the site's share card and its own
// URL as canonical; nothing about the class is read for the preview (no name, no database call), as a Mob invite's is.
const TITLE = 'Your class is on MockMob';
const DESCRIPTION = 'Sit the free Sunday Mock with your class and see the class average each Monday, beside your own marks. No names, no ranks. Sign up free to join.';

export async function generateMetadata({ params }) {
  const code = String((await params)?.code || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  const url = absoluteUrl(`/class/${code}`);
  const images = [DEFAULT_SHARE_IMAGE];
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: url },
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    openGraph: { type: 'website', siteName: siteConfig.name, title: TITLE, description: DESCRIPTION, url, images },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images },
  };
}

export default async function ClassJoinPage({ params }) {
  await connection();
  if (!classLeaguesEnabled()) notFound();
  const { code } = await params;
  return <ClassJoin code={String(code || '').slice(0, 16)} />;
}
