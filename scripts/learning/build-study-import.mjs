import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalStudyJSON } from '../../data/study_content.js';
const payload=JSON.parse(readFileSync('artifacts/study-suite/content-import-dry-run.json','utf8'));
const proof=JSON.parse(readFileSync('data/study/release.json','utf8'));
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
for(const kind of ['units','cards'])for(const row of payload[kind]){
  const hash=createHash('sha256').update(canonicalStudyJSON(row.content)).digest('hex');
  if(hash!==row.content_hash || proof[kind][`${row.id}@${row.version}`]?.contentHash!==hash)throw new Error('CONTENT_PROOF_MISMATCH');
}
// No updates: a reused version must be identical. Corrections require a new reviewed version.
const inserts=['units','cards'].flatMap(kind=>payload[kind].map(row=>`insert into public.study_${kind} select * from jsonb_populate_record(null::public.study_${kind},${literal(row)}) on conflict(id,version) do nothing;\ndo $$ begin if not exists(select 1 from public.study_${kind} where id=${literal(row)}->>'id' and version=(${literal(row)}->>'version')::integer and content_hash=${literal(row)}->>'content_hash') then raise exception 'Existing study version differs'; end if; end $$;`));
writeFileSync('artifacts/study-suite/current-project-content.sql',`-- Validated content only. No existing learning version is overwritten.\nbegin;\n${inserts.join('\n')}\ncommit;\nselect (select count(*) from public.study_units where publication_state='published') as published_units,(select count(*) from public.study_cards) as cards;\n`);
console.log(JSON.stringify({units:payload.units.length,cards:payload.cards.length,paidCalls:0,productionWrites:0}));
