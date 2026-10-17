import AppLayoutClient from './AppLayoutClient';
import { connection } from 'next/server';
import { contributeEnabled } from '@/lib/contribute';

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
  return <AppLayoutClient studyEnabled={process.env.STUDY_CONTENT_ENABLED==='true'} mobEnabled={process.env.MOB_ENABLED==='true'} contributeEnabled={contributeEnabled()}>{children}</AppLayoutClient>;
}
