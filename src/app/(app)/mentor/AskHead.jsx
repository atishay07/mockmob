import { PageHead } from '@/components/ui/PageHead';

// The Ask page head, shared by the page and the development preview (/preview/arena?view=prepos)
// so its copy lives in one place.
export default function AskHead() {
  return (
    <PageHead
      title="Ask about your record"
      lead="PrepOS answers from your own saved practice: your next step, your weak chapters, how a session went. Questions about your record are free. An optional written reply uses 1 PrepOS credit."
    />
  );
}
