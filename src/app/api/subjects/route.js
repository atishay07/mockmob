import { NextResponse } from 'next/server';
import { CUET_SUPPORTED_SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';

export async function GET() {
  return NextResponse.json(CUET_SUPPORTED_SUBJECTS.map((subject) => ({
    ...subject,
    id: toPublicSubjectId(subject.id),
    internalId: subject.id,
  })));
}
