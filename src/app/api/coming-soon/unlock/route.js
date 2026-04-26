import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "mockmob_preview_access";
const COOKIE_MAX_AGE = 60 * 60 * 24;

function getSecret() {
  return process.env.COMING_SOON_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || "mockmob-local-preview";
}

function getExpectedPassword() {
  return process.env.COMING_SOON_PASSWORD;
}

function signPreviewAccess(password) {
  return createHmac("sha256", getSecret()).update(`mockmob-preview:${password}`).digest("hex");
}

function safeEquals(a, b) {
  const left = Buffer.from(a || "");
  const right = Buffer.from(b || "");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request) {
  const expectedPassword = getExpectedPassword();

  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Preview access is not configured yet." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  if (!safeEquals(password, expectedPassword)) {
    return NextResponse.json({ error: "That passcode did not work." }, { status: 401 });
  }

  const cookieStore = await cookies();
  const isHttps = new URL(request.url).protocol === "https:";
  cookieStore.set(COOKIE_NAME, signPreviewAccess(expectedPassword), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}
