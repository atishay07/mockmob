import AppLayoutClient from './AppLayoutClient';
import { connection } from 'next/server';
import { contributeEnabled } from '@/lib/contribute';
import { publicOffer } from '@/lib/payments/offer';
import { classLeaguesEnabled } from '@/lib/classLeague/flag.mjs';
import { ClassLeagueSwitch } from '@/components/class/ClassSwitch';

export const metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function AppLayout({ children }) {
  await connection();
  return <AppLayoutClient studyEnabled={process.env.STUDY_CONTENT_ENABLED==='true'} mobEnabled={process.env.MOB_ENABLED==='true'} contributeEnabled={contributeEnabled()} offer={publicOffer()}>{/* Class leagues: off unless CLASS_LEAGUES_ENABLED=true; off, no class surface mounts. */}<ClassLeagueSwitch on={classLeaguesEnabled()}>{children}</ClassLeagueSwitch></AppLayoutClient>;
}
