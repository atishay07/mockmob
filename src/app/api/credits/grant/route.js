import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Credit grants are only issued by approved contribution moderation.' },
    { status: 410 },
  );
}
