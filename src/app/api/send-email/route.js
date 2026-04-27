import { NextResponse } from 'next/server';
import { resend } from '@/lib/resend';

export async function POST(request) {
  try {
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
