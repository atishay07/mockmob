import { NextResponse } from 'next/server';
import { resend } from '@/lib/resend';
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { isAdmin } from '@/lib/admin/roles';

export async function POST(request) {
  try {
    if (process.env.EMAIL_TEST_ENDPOINT_ENABLED !== 'true') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const session = await auth(request);
    if (!isAdmin(session?.user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await checkPersistentRateLimit(request, { route: '/api/send-email', limit: 5, keyParts: [session.user.id] })).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const body = await request.json().catch(() => ({}));
    const to = typeof body?.to === 'string' && body.to.trim() ? body.to.trim() : 'atishay07jain@gmail.com';
    const subject = typeof body?.subject === 'string' && body.subject.trim() ? body.subject.trim() : 'Hello World';
    const html =
      typeof body?.html === 'string' && body.html.trim()
        ? body.html
        : '<p>Congrats on sending your <strong>first email</strong>!</p>';

    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject,
      html,
    });

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    console.error('[api/send-email] POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 },
    );
  }
}
