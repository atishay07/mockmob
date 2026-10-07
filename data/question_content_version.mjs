import { contentHash } from './content_evidence.js';
import { toInternalSubjectId } from './cuet_controls.js';
// Database rows and saved public snapshots use different field names. Normalize
// both before binding a dispute to the content the model actually reviewed.
export function questionContentVersion(question,subjectFallback) {
  return contentHash({...question,subject:toInternalSubjectId(question.internalSubject || question.subject || subjectFallback),
    concept_id:question.concept_id || question.conceptId || null,family_id:question.family_id || question.familyId || null,
    passage_text:question.passage_text || question.passageText || ''});
}
