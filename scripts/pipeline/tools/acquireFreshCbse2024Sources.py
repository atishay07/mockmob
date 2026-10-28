"""Acquire question-only sources after a pinned validator binding; never read keys."""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import urllib.request
from pypdf import PdfReader

ROOT = pathlib.Path('artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-2024-25-source-keys-v4')
BINDING = ROOT / 'PRE-ACQUISITION-BINDING.json'
EXPECTED_BINDING_HASH = 'd60f01257973cda20ca016f7736740dc30e8d56f7869e91d9267a75570e34966'
if hashlib.sha256(BINDING.read_bytes()).hexdigest() != EXPECTED_BINDING_HASH:
    raise RuntimeError('pre_acquisition_binding_changed')
PLAN = json.loads(BINDING.read_text(encoding='utf-8'))
PAPERS = [('accountancy', 'Accountancy'), ('business_studies', 'BusinessStudies'),
          ('economics', 'Economics'), ('english', 'EnglishCore')]
(ROOT / 'papers').mkdir(exist_ok=True)

def acquire(pair):
    subject, filename = pair
    url = f'https://cbseacademic.nic.in/web_material/SQP/ClassXII_2024_25/{filename}-SQP.pdf'
    pdf_path = ROOT / 'papers' / f'{subject}-sqp.pdf'
    if not pdf_path.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=40) as response:
            body = response.read()
        if not body.startswith(b'%PDF') or len(body) < 1000:
            raise RuntimeError('official_question_source_not_pdf:' + subject)
        pdf_path.write_bytes(body)
    body = pdf_path.read_bytes()
    pages = []
    for index, page in enumerate(PdfReader(pdf_path).pages):
        text = re.sub(r'\s+', ' ', page.extract_text() or '').strip()
        pages.append({'page': index + 1, 'text': text,
                      'text_sha256': hashlib.sha256(text.encode()).hexdigest()})
    cache = ROOT / 'papers' / f'{subject}-sqp.pages.json'
    record = {'source_id': f'cbse-2024-25-{subject}-sqp', 'subject': subject,
              'official_url': url, 'pdf_path': str(pdf_path.resolve()),
              'pdf_sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body),
              'extraction_method': 'pypdf original content-stream order; whitespace normalized',
              'pages': pages, 'source_kind': 'official_cbse_sample_question_paper_not_cuet_pyq'}
    if cache.exists():
        previous = json.loads(cache.read_text(encoding='utf-8'))
        if previous != record:
            raise RuntimeError('existing_question_source_cache_changed:' + subject)
    else:
        cache.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {key: value for key, value in record.items() if key != 'pages'} | {
        'page_count': len(pages), 'cache_path': str(cache.resolve()),
        'cache_sha256': hashlib.sha256(cache.read_bytes()).hexdigest()}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    documents = list(pool.map(acquire, PAPERS))
output = ROOT / 'QUESTION-SOURCE-MANIFEST.json'
manifest = {'acquired_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'pre_acquisition_binding_path': str(BINDING.resolve()),
            'pre_acquisition_binding_sha256': EXPECTED_BINDING_HASH,
            'validator_binding': PLAN['binding'], 'official_index_url': PLAN['official_index_url'],
            'documents': documents, 'sealed_key_documents_read': 0, 'paid_calls': 0,
            'candidate_or_release_status': 'construction_not_started',
            'permission_basis': 'Private official reference custody and brief attributed educational verification excerpts; no unrestricted publication or redistribution claim',
            'limitations': ['CBSE papers are academic references, not authenticated CUET PYQs.',
                            'Extracted text still needs semantic and rendered-page checking.',
                            'The earlier-read Economics question 14 worked example is excluded.']}
if output.exists():
    previous = json.loads(output.read_text(encoding='utf-8'))
    if previous['documents'] != documents:
        raise RuntimeError('question_source_manifest_changed')
else:
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'manifest': str(output), 'manifest_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                  'documents': [{k: d[k] for k in ('subject', 'pdf_sha256', 'page_count')} for d in documents],
                  'paid_calls': 0, 'key_documents_read': 0}))
