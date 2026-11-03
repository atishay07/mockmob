"""Open official candidate keys only after all 32 independent first passes are frozen."""
import concurrent.futures,datetime,hashlib,json,pathlib,re,urllib.request
from pypdf import PdfReader
ROOT=pathlib.Path('artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-2024-25-source-keys-v4')
freeze_path=ROOT/'SECOND-REVIEW-FREEZE.json'
freeze=json.loads(freeze_path.read_text(encoding='utf-8'))
if freeze['raw_denominator']!=32 or freeze['official_candidate_marking_schemes_read'] is not False:
 raise RuntimeError('all_blind_first_passes_must_precede_gold')
for r in freeze['reviews']:
 if hashlib.sha256(pathlib.Path(r['path']).read_bytes()).hexdigest()!=r['sha256']:
  raise RuntimeError('immutable_review_changed')
def acquire(pair):
 subject,name=pair
 url=f'https://cbseacademic.nic.in/web_material/SQP/ClassXII_2024_25/{name}-MS.pdf'
 pdf=ROOT/'papers'/f'{subject}-ms.pdf'
 if not pdf.exists():
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=45) as response: body=response.read()
  if not body.startswith(b'%PDF') or len(body)<1000: raise RuntimeError('official_marking_scheme_not_pdf:'+subject)
  with pdf.open('xb') as handle: handle.write(body)
 body=pdf.read_bytes()
 pages=[{'page':i+1,'text':re.sub(r'\s+',' ',page.extract_text() or '').strip()} for i,page in enumerate(PdfReader(pdf).pages)]
 record={'subject':subject,'official_url':url,'pdf_path':str(pdf.resolve()),'pdf_sha256':hashlib.sha256(body).hexdigest(),'pages':pages}
 cache=ROOT/'papers'/f'{subject}-ms.pages.json'
 if cache.exists():
  if json.loads(cache.read_text(encoding='utf-8'))!=record: raise RuntimeError('existing_key_cache_changed')
 else: cache.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 return {k:v for k,v in record.items() if k!='pages'}|{'cache_path':str(cache.resolve()),'cache_sha256':hashlib.sha256(cache.read_bytes()).hexdigest(),'page_count':len(pages)}
pairs=[('accountancy','Accountancy'),('business_studies','BusinessStudies'),('economics','Economics'),('english','EnglishCore')]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: documents=list(pool.map(acquire,pairs))
manifest={'acquired_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'second_review_freeze_sha256':hashlib.sha256(freeze_path.read_bytes()).hexdigest(),'documents':documents,'paid_calls':0,'limitations':['CBSE keys are academic source evidence, not authenticated CUET PYQs.','Economics Q14 was seen earlier and is excluded.','Disagreement with an official key remains held; no frozen independent answer is rewritten.']}
target=ROOT/'OFFICIAL-KEY-SOURCE-MANIFEST.json'
if target.exists():
 if json.loads(target.read_text(encoding='utf-8'))['documents']!=documents: raise RuntimeError('immutable_key_manifest_changed')
else: target.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'manifest':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'documents':len(documents),'paid_calls':0}))
