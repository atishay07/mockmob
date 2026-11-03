import { loadEnvFile } from 'node:process';
import { readFileSync,appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

// Authorized local commissioning only. Never alters database users or deploys secrets.
loadEnvFile('.env.local');
const path=resolve('.env.local'),text=readFileSync(path,'utf8');
const pending=[];
if(!process.env.CUET_EVIDENCE_SIGNING_KEY && !/^CUET_EVIDENCE_SIGNING_KEY=/m.test(text))pending.push(`CUET_EVIDENCE_SIGNING_KEY=${randomBytes(48).toString('hex')}`);
let authorConfigured=Boolean(process.env.CUET_CONTENT_AUTHOR_ID);
if(!authorConfigured && !/^CUET_CONTENT_AUTHOR_ID=/m.test(text)) {
  const roles=readFileSync(resolve('src/lib/admin/roles.js'),'utf8'),email=roles.match(/ADMIN_EMAIL\s*=\s*'([^']+)'/)?.[1];
  const url=process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if(!email || !url || !process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('existing_content_author_lookup_required');
  const response=await fetch(`${url}/rest/v1/users?select=id&email=eq.${encodeURIComponent(email)}&limit=2`,{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`},signal:AbortSignal.timeout(20000),redirect:'error'});
  const rows=await response.json();
  if(!response.ok || !Array.isArray(rows) || rows.length!==1 || !/^[\w-]+$/.test(rows[0].id))throw new Error('existing_content_author_lookup_required');
  pending.push(`CUET_CONTENT_AUTHOR_ID=${rows[0].id}`);authorConfigured=true;
}
if(pending.length)appendFileSync(path,`${text.endsWith('\n')?'':'\r\n'}\r\n# Local question factory signing and existing author; keep private.\r\n${pending.join('\r\n')}\r\n`);
console.log(JSON.stringify({local_only:true,configured_names:pending.map(line=>line.split('=')[0]),signing_key_configured:Boolean(process.env.CUET_EVIDENCE_SIGNING_KEY || pending.some(line=>line.startsWith('CUET_EVIDENCE_SIGNING_KEY='))),content_author_configured:authorConfigured,production_changes:0,secrets_printed:false}));
