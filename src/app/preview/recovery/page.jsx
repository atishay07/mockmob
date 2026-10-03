import { notFound } from 'next/navigation';
import ScoreRecoveryLab from '@/components/ScoreRecoveryLab';
export default function RecoveryDesignPreview(){
  if(process.env.NODE_ENV==='production')notFound();
  const attempt={id:'design-example',subject:'economics',correct:3,wrong:1,total:5,unattempted:1,
    questionsSnapshot:[{id:'q4',chapter:'Money & Banking'}],details:[{qid:'q4',isCorrect:false}],
    selectionMeta:{scoringVersion:'server_snapshot_v1',recovery:{telemetry:'self_reported',timeline:[{seq:1,qid:'q4',type:'answer',answer:1,at:42000},{seq:2,qid:'q4',type:'visit',at:180000},{seq:3,qid:'q4',type:'answer',answer:3,at:198000}],observed:{answerChanges:[{qid:'q4',at:198000,before:1,after:3,markEffect:-6}],unanswered:1},recommendation:{title:'Practise one concept you missed'}}}};
  return <main style={{padding:'24px',background:'#eaece3',minHeight:'100vh'}}><p style={{color:'#3e453b',maxWidth:'960px',margin:'auto'}}>Development design preview · illustrative data · available only in development.</p><ScoreRecoveryLab attempt={attempt}/></main>;
}
