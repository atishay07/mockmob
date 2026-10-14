import AIMentorTerminal from '@/components/ai/AIMentorTerminal';
import { PageHead } from '@/components/ui/PageHead';
import './ask.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ask about your record | MockMob' };

// Ask about your record (PrepOS). Web redesign W2.4: the plain name first and the brand name as
// its descriptor (owner decision D10). The assistant itself lives in components/ai; its own older
// page head is hidden here (ask.css) until that file adopts this one.
export default function MentorPage() {
  return (
    <div className="student-page student-page--mentor askx">
      <PageHead
        title="Ask about your record"
        lead="PrepOS answers from your own saved practice: your next step, your weak chapters, how a session went. Questions about your record are free. An optional written reply uses 1 PrepOS credit."
      />
      <AIMentorTerminal />
    </div>
  );
}
