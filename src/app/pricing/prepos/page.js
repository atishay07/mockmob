// The credits page moved to /pricing/ai-credits (the PrepOS name is retired; the feature is Ask Mobi).
// Old links, bookmarks and payment callbacks keep working through this permanent redirect.
import { permanentRedirect } from 'next/navigation';

export default function OldAICreditsPage() {
  permanentRedirect('/pricing/ai-credits');
}
