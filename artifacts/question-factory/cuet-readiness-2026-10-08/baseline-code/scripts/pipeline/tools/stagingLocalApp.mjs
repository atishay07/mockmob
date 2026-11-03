import {loadEnvFile} from 'node:process';
import {spawn} from 'node:child_process';
try { loadEnvFile('.env.local'); } catch {}
loadEnvFile('.env.staging');
const target='https://onwkqxmjqjrhfbjjdydu.supabase.co';
if(process.env.STAGING_SUPABASE_URL!==target) throw Error('wrong_staging_project');
for(const key of ['STAGING_SUPABASE_ANON_KEY','STAGING_SUPABASE_SERVICE_ROLE_KEY']) if(!process.env[key]) throw Error('missing_'+key);
const env={...process.env,MOCKMOB_STAGING_APP:'1',NEXT_PUBLIC_SUPABASE_URL:target,SUPABASE_URL:target,NEXT_PUBLIC_SUPABASE_ANON_KEY:process.env.STAGING_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY};
// This isolated app cannot send email or make paid student/payment provider calls.
for(const key of Object.keys(env)) if(/^(OPENAI|GEMINI|ANTHROPIC|DEEPSEEK|RAZORPAY|RESEND|AI_GATEWAY).*KEY/.test(key)) env[key]='';
const child=spawn(process.execPath,['--use-system-ca','node_modules/next/dist/bin/next','dev','--port','3101'],{env,stdio:['inherit','pipe','pipe']});
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>process.stdout.write(chunk.toString().replace(/(token_hash=)[^&\s]+/g,'$1[redacted]')));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
