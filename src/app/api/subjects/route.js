import { NextResponse } from 'next/server';
import { SUBJECTS } from '@/../data/subjects';

export async function GET() {
  return NextResponse.json(SUBJECTS);
}
