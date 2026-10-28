import { Suspense } from 'react';
import StudyWorkspace from '@/components/study/StudyWorkspace';
export default async function Learn({searchParams}) { const params=await searchParams;return <Suspense fallback={<p>Loading Learn…</p>}><StudyWorkspace autoRecall={params.recall==='due'}/></Suspense>; }
