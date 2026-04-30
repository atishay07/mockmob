import { NextResponse } from 'next/server';
import { SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';

export async function GET() {
  return NextResponse.json(SUBJECTS.map((subject) => ({
    ...subject,
    id: toPublicSubjectId(subject.id),
    internalId: subject.id,
  })));
}
