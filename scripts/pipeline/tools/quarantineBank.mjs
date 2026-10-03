import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const report=JSON.parse(readFileSync(resolve(process.argv[2] || 'artifacts/recovery/bank-audit.json'),'utf8'));
if(!report.read_only || !report.created_at || !Array.isArray(report.findings)) throw new Error('Audit report required');
// Missing evidence alone recommends a hold; it never invents a semantic defect.
const changes=report.findings.filter(f=>f.origin==='database' && f.status==='invalid').map(f=>({id:f.id,expected_hash:f.content_hash,expected_content:f.expected_content,expected_options:f.expected_options,expected_key:f.expected_key,reason:f.reasons.join('; ')}));
writeFileSync('artifacts/recovery/quarantine-plan.json',JSON.stringify({dry_run:true,audit_created_at:report.created_at,changes},null,2));
if(process.argv.includes('--apply')) {
  const { createClient }=await import('@supabase/supabase-js');
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
  // The RPC saves the old row and checks the audit snapshot before any change.
  const {data,error}=await client.rpc('quarantine_recovery_questions',{p_changes:changes});
  if(error) throw new Error('Reversible quarantine failed: '+error.code);
  console.log(JSON.stringify({quarantined:data}));
} else console.log(JSON.stringify({dry_run:true,recommendations:changes.length}));
