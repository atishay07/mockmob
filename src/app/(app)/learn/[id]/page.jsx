import { Suspense } from 'react';
import StudyWorkspace from '@/components/study/StudyWorkspace';
export default async function Lesson({params}) { const {id}=await params;return <Suspense fallback={null}><StudyWorkspace unitId={id}/></Suspense>; }
