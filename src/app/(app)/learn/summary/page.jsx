import StudyChapterSummary from '@/components/study/StudyChapterSummary';
export const metadata={title:'Chapter summary — MockMob',robots:{index:false,follow:false}};
export default async function Page({searchParams}) {
  const params=await searchParams;
  return <StudyChapterSummary subject={params.subject || ''} chapter={params.chapter || ''} />;
}
