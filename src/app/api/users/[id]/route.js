import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const user = await Database.getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (e) {
    console.error('[api/users/:id] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session || session.user.id !== id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updatedUser = await Database.updateUser(id, body);

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(updatedUser);
  } catch (e) {
    console.error('[api/users/:id] PATCH failed:', e);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
