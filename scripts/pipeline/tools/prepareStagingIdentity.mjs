import {loadEnvFile} from 'node:process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
loadEnvFile('.env.staging');
const url=process.env.STAGING_SUPABASE_URL;
if(url!=='https://onwkqxmjqjrhfbjjdydu.supabase.co') throw Error('wrong_staging_project');
const admin=createClient(url,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {error:probeError}=await admin.from('question_factory_control').select('id').limit(1);
if(probeError) throw Error('staging_schema_probe:'+probeError.message);
const identities={};
for(const [name,email,role] of [['admin','atishay07jain@gmail.com','admin'],['student','factory-staging-student@example.com','student']]) {
 const {data,error}=await admin.auth.admin.generateLink({type:'magiclink',email});
 if(error) throw Error('staging_identity:'+error.message);
 const {error:writeError}=await admin.from('users').upsert({id:data.user.id,email,name:'Factory staging '+name,role,subjects:['english','accountancy','business_studies','economics']});
 if(writeError) throw Error('staging_user:'+writeError.message);
 identities[name]={id:data.user.id,token_hash:data.properties.hashed_token,type:data.properties.verification_type};
}
mkdirSync('.cache',{recursive:true});
writeFileSync('.cache/factory-staging-auth.json',JSON.stringify(identities));
const proof={target:url,at:new Date().toISOString(),identities:Object.fromEntries(Object.entries(identities).map(([name,v])=>[name,{id:v.id,role:name==='admin'?'admin':'student'}])),emails_sent:0};
writeFileSync('artifacts/question-factory/execution-2026-10-07/staging/identities.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
