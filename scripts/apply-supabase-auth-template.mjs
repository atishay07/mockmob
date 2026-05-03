import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TEMPLATE_PATH = resolve(ROOT, 'supabase/templates/magic_link.html');

function parseDotEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, '')];
      }),
  );
}

async function readEnvFile() {
  try {
    return parseDotEnv(await readFile(resolve(ROOT, '.env.local'), 'utf8'));
  } catch {
    return {};
  }
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return null;
  }
}

const envFile = await readEnvFile();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || envFile.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envFile.NEXT_PUBLIC_SUPABASE_URL || envFile.SUPABASE_URL;
const projectRef = process.env.SUPABASE_PROJECT_REF || envFile.SUPABASE_PROJECT_REF || projectRefFromUrl(supabaseUrl);
const template = await readFile(TEMPLATE_PATH, 'utf8');

if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({
    ok: true,
    templatePath: TEMPLATE_PATH,
    templateBytes: Buffer.byteLength(template),
    hasConfirmationUrl: template.includes('{{ .ConfirmationURL }}'),
    hasToken: template.includes('{{ .Token }}'),
    projectRef: projectRef || null,
    canApply: Boolean(accessToken && projectRef),
  }, null, 2));
  process.exit(0);
}

if (!accessToken) {
  throw new Error('Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens and set it before running this script.');
}

if (!projectRef) {
  throw new Error('Missing project ref. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL.');
}

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: 'PATCH',
  headers: {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    mailer_subjects_magic_link: 'Your MockMob login link and code',
    mailer_templates_magic_link_content: template,
  }),
});

if (!res.ok) {
  const body = await res.text();
  throw new Error(`Supabase template update failed (${res.status}): ${body}`);
}

console.log(`Updated Supabase Magic Link email template for project ${projectRef}.`);
