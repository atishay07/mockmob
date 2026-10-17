import { Suspense } from 'react';
import StudyWorkspace from '@/components/study/StudyWorkspace';
export default async function Study({params}) { const {id}=await params;return <Suspense fallback={null}><StudyWorkspace runId={id}/></Suspense>; }
