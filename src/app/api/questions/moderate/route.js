import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';

export async function POST(request) {
  try {
    const { id, action } = await request.json(); // action = 'approve' | 'reject'
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const result = await Database.moderateQuestion(id, action);
    if (!result) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
