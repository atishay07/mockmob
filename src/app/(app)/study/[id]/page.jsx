import StudyWorkspace from '@/components/study/StudyWorkspace';
export default async function Study({params}) { const {id}=await params;return <StudyWorkspace runId={id}/>; }
