"use client";

// Practice's one row for Ask Mobi (ASK-MOBI-1018, section 3; D5): under the subjects loop, in the page's own tokens, with
// what the record says about the weakest chapter as its preview. The preview is the record's real line with its denominator,
// and is left out when the record has none (a new student, or a record that could not be read). The loop does not change.
import { useAuth } from '@/components/AuthProvider';
import { AppIcon } from '@/components/ui/Glyph';
import AskMobiLink from './AskMobiLink';
import { ENTRY_LABELS, practiceContext, practicePreview } from './askContexts.mjs';
import { useInsights } from './useInsights';

export default function PracticeAskRow() {
  const { user } = useAuth();
  const { insights } = useInsights(user?.id || null);
  const preview = practicePreview(insights);
  return (
    <AskMobiLink context={practiceContext(insights)} variant="row" className="ame--practice">
      <span className="ame__icon" aria-hidden="true"><AppIcon name="prepos" size={20} /></span>
      <b>{ENTRY_LABELS.practice}</b>
      {preview ? <span>{preview}</span> : null}
    </AskMobiLink>
  );
}
