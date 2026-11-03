import StudyWorkspace from '@/components/study/StudyWorkspace';
export default async function Lesson({params}) { const {id}=await params;return <StudyWorkspace unitId={id}/>; }
