import AppLayoutClient from './AppLayoutClient';
import { connection } from 'next/server';

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
  return <AppLayoutClient studyEnabled={process.env.STUDY_CONTENT_ENABLED==='true'}>{children}</AppLayoutClient>;
}
