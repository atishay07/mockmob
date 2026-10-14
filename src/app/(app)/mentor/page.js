import AIMentorTerminal from '@/components/ai/AIMentorTerminal';
import AskHead from './AskHead';
import './ask.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ask about your record | MockMob' };

// Ask about your record (PrepOS). Web redesign W2.4: the plain name first and the brand name as
// its descriptor (owner decision D10). The assistant itself lives in components/ai; its own older
// page head is hidden here (ask.css) until that file adopts this one.
export default function MentorPage() {
  return (
    <div className="student-page student-page--mentor askx">
      <AskHead />
      <AIMentorTerminal />
    </div>
  );
}
