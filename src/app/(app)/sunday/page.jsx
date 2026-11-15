import SundayPage from '@/components/sunday/SundayPage';

// The Sunday Mock (15 Nov 2026): this week's fixed full paper in each of the student's subjects (src/components/sunday/SundayPage.jsx).
export const metadata = {
  title: 'Sunday Mock | MockMob',
  description: 'One full paper in each of your subjects, the same for everyone, every Sunday from 10:00 AM to 10:00 PM.',
};

export default function SundayMockPage() {
  return <SundayPage />;
}
