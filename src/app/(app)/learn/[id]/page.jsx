import StudyWorkspace from '@/components/study/StudyWorkspace';

export const metadata = { title: 'Lesson | MockMob' };

export default async function Lesson({ params }) {
  const { id } = await params;
  return <StudyWorkspace unitId={id} />;
}
