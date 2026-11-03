from pathlib import Path
import pdfplumber, json, hashlib, subprocess
root=Path('artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-source-prep/acquisition-2021-22')
manifest=[]
for path in root.glob('*-SQP.pdf'):
    with pdfplumber.open(path) as doc:
        pages=[{'page':i+1,'text':page.extract_text() or ''} for i,page in enumerate(doc.pages)]
    out=path.with_suffix('.pages.json')
    out.write_text(json.dumps(pages,ensure_ascii=False,indent=2),encoding='utf-8')
    path.with_suffix('.txt').write_text('\n'.join(f'PAGE {p["page"]}\n{p["text"]}' for p in pages),encoding='utf-8')
    # First source pages are rendered for question/stimulus and symbol verification.
    subprocess.run(['pdftoppm','-f','1','-l','3','-scale-to','1400','-png',str(path),str(root/f'{path.stem}-p')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    manifest.append({'path':str(path),'pages':len(pages),'extraction_sha256':hashlib.sha256(out.read_bytes()).hexdigest()})
print(json.dumps(manifest))
