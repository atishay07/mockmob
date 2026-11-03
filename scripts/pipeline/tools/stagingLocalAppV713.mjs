import { loadEnvFile } from 'node:process';
import { resolve, relative, isAbsolute } from 'node:path';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { assertFactoryProfileV713 } from '../lib/factoryProfileV713.mjs';
const registryPath = resolve(process.argv[2] || ''), within = relative(resolve('artifacts/question-factory'), registryPath);
if (!process.argv[2] || !within || within.startsWith('..') || isAbsolute(within)) throw Error('registered_staging_registry_required');
const directory = resolve(registryPath, '..'), read = p => JSON.parse(readFileSync(p, 'utf8'));
assertFactoryProfileV713(read(resolve(directory, 'verification-profile.json')), { registry: read(registryPath), manifest: read('data/calibration_manifest.json') });
try { loadEnvFile('.env.local'); } catch {}
loadEnvFile('.env.staging');
const target = 'https://onwkqxmjqjrhfbjjdydu.supabase.co';
if (process.env.STAGING_SUPABASE_URL !== target || !process.env.STAGING_SUPABASE_ANON_KEY || !process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY) throw Error('isolated_staging_credentials_required');
const env = { ...process.env, MOCKMOB_STAGING_APP: '1', CUET_STAGING_REGISTRY_FILE: registryPath,
  NEXT_PUBLIC_SUPABASE_URL: target, SUPABASE_URL: target, NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.STAGING_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY };
for (const key of Object.keys(env)) if (/^(OPENAI|GEMINI|ANTHROPIC|DEEPSEEK|RAZORPAY|RESEND|AI_GATEWAY).*KEY/.test(key)) env[key] = '';
const child = spawn(process.execPath, ['--use-system-ca', 'node_modules/next/dist/bin/next', 'dev', '--port', '3101'], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
