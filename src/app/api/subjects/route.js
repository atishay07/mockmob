import { NextResponse } from 'next/server';
import { SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';
import { resolveSubject, SUBJECT_REGISTRY_VERSION } from '@/../data/subject_registry';

export async function GET() {
  return NextResponse.json(SUBJECTS.map((subject) => {
    const id = toPublicSubjectId(subject.id);
    const registry = resolveSubject(id);
    return {
      ...subject,
      id,
      internalId: subject.id,
      officialCode: registry.code,
      officialName: registry.officialName,
      // A crosswalked legacy row (e.g. Applied Mathematics → 319) is not offered as a second card.
      practice: registry.renamedFrom ? 'merged' : registry.practice,
      practiceReason: registry.renamedFrom ? `Examined with ${registry.officialName} (${registry.code}). Choose that subject.` : registry.reason,
      mergedInto: registry.renamedFrom ? registry.id : null,
      registryVersion: SUBJECT_REGISTRY_VERSION,
    };
  }));
}
