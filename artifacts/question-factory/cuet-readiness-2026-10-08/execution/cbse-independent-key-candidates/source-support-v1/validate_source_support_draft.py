from pathlib import Path
import json,hashlib,sys
root=Path.cwd(); folder=root/'artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-independent-key-candidates/source-support-v1'
p=folder/'source-support-draft-v1.json'; data=json.loads(p.read_text(encoding='utf-8')); reg=json.loads((root/'data/source_registry.json').read_text(encoding='utf-8')); src=reg['sources']; R=root/'data/question-factory-runtime'
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
errors=[]; seen=set();
if len(data['items'])!=64: errors.append('denominator is not 64')
if len({x['item_id'] for x in data['items']})!=64: errors.append('item IDs not unique')
if data['registry_snapshot']['sha256']!=sha(root/'data/source_registry.json'): errors.append('source registry hash changed')
for b in data['input_bindings']:
 if sha(root/b['file'])!=b['sha256']: errors.append(f"candidate input changed: {b['file']}")
for e in data['evidence_spans']:
 sid=e['span_id']
 if sid in seen: errors.append('duplicate span '+sid)
 seen.add(sid)
 if e['source_kind']=='official_ncert_textbook':
  s=src.get(e['source_id']);
  if not s: errors.append(f'{sid}: source absent from registry'); continue
  if s.get('identity_sha256')!=e['source_pdf_sha256'] or s.get('extraction_sha256')!=e['source_extraction_sha256']: errors.append(f'{sid}: source identity/extraction mismatch')
  pdf=Path(s.get('file','')); pdf=pdf if pdf.is_absolute() else (root/pdf if str(pdf).replace('\\','/').startswith('data/') else R/pdf)
  ext=Path(s.get('extraction_file','')); ext=ext if ext.is_absolute() else (root/ext if str(ext).replace('\\','/').startswith('data/') else R/ext)
  if not pdf.exists() or sha(pdf)!=e['source_pdf_sha256']: errors.append(f'{sid}: PDF hash mismatch/missing')
  if not ext.exists() or sha(ext)!=e['source_extraction_sha256']: errors.append(f'{sid}: extraction hash mismatch/missing')
  mp=root/e['page_map_file']
  if not mp.exists() or sha(mp)!=e['page_map_sha256']: errors.append(f'{sid}: page map hash mismatch/missing'); continue
  pages=json.loads(mp.read_text(encoding='utf-8')); target=None
  for pg in pages:
   phys=pg.get('pdf_page_1based',pg.get('page'))
   if phys==e['physical_pdf_page']:
    text=pg.get('text') or '\n'.join(pg.get('columns',[]))
    if hashlib.sha256(text.encode()).hexdigest()==e['page_text_sha256']: target=text; break
  if target is None: errors.append(f'{sid}: page text not found/hash mismatch')
  elif target[e['quote_start']:e['quote_end']]!=e['quote']: errors.append(f'{sid}: quote offsets do not reproduce quote')
 elif e['source_kind']=='official_cuet_syllabus':
  s=src.get(e['source_id']);
  if not s: errors.append(f'{sid}: syllabus source absent from registry'); continue
  if s.get('identity_sha256')!=e['source_pdf_sha256'] or s.get('extraction_sha256')!=e['source_extraction_sha256']: errors.append(f'{sid}: syllabus hash mismatch')
  txt=(R/s['extraction_file']).read_text(encoding='utf-8',errors='replace')
  import re
  m=re.search(r'(?ms)^PAGE\s+'+str(e['physical_pdf_page'])+r'\s*\n(.*?)(?=^PAGE\s+\d+\s*$|\Z)',txt)
  if not m: errors.append(f'{sid}: syllabus page absent'); continue
  if hashlib.sha256(m.group(1).encode()).hexdigest()!=e['page_text_sha256']: errors.append(f'{sid}: syllabus page hash mismatch')
  elif m.group(1)[e['quote_start']:e['quote_end']].strip()!=e['quote']: errors.append(f'{sid}: syllabus quote offsets do not reproduce')
 elif e['source_kind']=='adapted_candidate_passage':
  b=next((x for x in data['input_bindings'] if x['file']==e['candidate_file']),None)
  if not b or b['sha256']!=e['candidate_file_sha256']: errors.append(f'{sid}: candidate passage input binding absent')
  else:
   d=json.loads((root/e['candidate_file']).read_text(encoding='utf-8')); st=next((x for x in d.get('stimuli',[]) if x['stimulus_id']==e['stimulus_id']),None)
   if not st: errors.append(f'{sid}: stimulus absent')
   else:
    if hashlib.sha256(st['text'].encode()).hexdigest()!=e['stimulus_text_sha256']: errors.append(f'{sid}: stimulus hash mismatch')
    if st['text'][e['quote_start']:e['quote_end']]!=e['quote']: errors.append(f'{sid}: passage quote offsets do not reproduce')
for i in data['items']:
 for sid in i['evidence_span_ids']+[i['syllabus_entitlement']['source_span_id']]:
  if sid not in seen: errors.append(f"{i['item_id']}: missing linked span {sid}")
print('items',len(data['items']),'spans',len(seen),'errors',len(errors))
for e in errors: print('ERROR',e)
if errors: sys.exit(1)
print('PASS: exact source hashes, page offsets, candidate bindings, and 64-item denominator verified')
