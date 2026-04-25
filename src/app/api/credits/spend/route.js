import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Credit spending is only performed by question generation endpoints.' },
    { status: 410 },
  );
}
