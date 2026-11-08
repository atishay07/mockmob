import MentorRecordPage from '@/components/ai/MentorRecordPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ask Mobi | MockMob',
  description: 'Ask Mobi any CUET doubt, or ask what your own papers say.',
};

export default function MentorPage() {
  return <div className="student-page student-page--mentor"><MentorRecordPage /></div>;
}
