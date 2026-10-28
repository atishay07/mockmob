import { readFileSync } from 'node:fs';

const normalize=value=>String(value).replace(/\s+/g,' ').trim();
const officialHosts=['nta.ac.in','www.nta.ac.in','cuet.nta.nic.in'];
function publisher(copy) {
  const host=new URL(copy.url).hostname;
  if(['prepp.in','collegedunia.com','zollege.in'].some(domain=>host===domain || host.endsWith(`.${domain}`)))return 'collegedunia';
  if(!copy.publisher_group || !copy.publisher_ownership_reference)throw new Error('mirror_publisher_ownership_required');
  return copy.publisher_group.toLowerCase();
}
// This accepts corroborated copies, never silently relabels a mirror as an NTA
// download. Full checked transcripts and their raw-file identities are retained.
export function corroboratePaper(doc,{localFile,fileHash,subject},root) {
  const a=doc.authentication;
  if(a?.type!=='corroborated_mirror' || !a.identity || !Array.isArray(a.copies) || !a.copies.length || !Array.isArray(a.questions) || !a.questions.length)
    throw new Error('complete_mirror_corroboration_required');
  const primary={...doc,publisher_group:a.publisher_group,publisher_ownership_reference:a.publisher_ownership_reference};
  const copies=[primary,...a.copies],operators=copies.map(publisher);
  if(new Set(operators).size<2)throw new Error('independent_mirror_publishers_required');
  const texts=copies.map(copy=>{
    const raw=localFile(root,copy.file),extract=localFile(root,copy.extraction_file);
    if(fileHash(raw)!==copy.identity_sha256 || fileHash(extract)!==copy.extraction_sha256 || copy.extraction_checked!==true)
      throw new Error('mirror_file_or_transcript_changed');
    return normalize(readFileSync(extract,'utf8'));
  });
  const catalog=a.catalog;
  if(!catalog || !['www.ndl.gov.in','ndl.gov.in','ndl.iitkgp.ac.in','www.ndl.iitkgp.ac.in',...officialHosts].includes(new URL(catalog.url).hostname) ||
      fileHash(localFile(root,catalog.file))!==catalog.identity_sha256 || !catalog.quote || !normalize(readFileSync(localFile(root,catalog.file),'utf8')).includes(normalize(catalog.quote)))
    throw new Error('government_paper_catalog_evidence_required');
  const {subject_code,language,booklet,key_date_token,year}=a.identity;
  const codes={english:'101',accountancy:'301',business_studies:'305',economics:'309'};
  if(subject_code!==codes[subject] || !language || !/^[ABCD]$/.test(booklet || '') || year!==doc.year || !key_date_token || !key_date_token.includes(String(year)))
    throw new Error('mirror_paper_identity_required');
  if(!normalize(catalog.quote).includes(String(year)) || !a.catalog.subject_quote || !normalize(catalog.quote).includes(normalize(a.catalog.subject_quote)))
    throw new Error('catalog_paper_identity_mismatch');
  if(!a.paper_identity_quotes || a.paper_identity_quotes.length!==copies.length || a.paper_identity_quotes.some((quote,i)=>!quote || !texts[i].includes(normalize(quote)) || !quote.includes(subject_code) || !quote.includes(booklet)))
    throw new Error('mirror_booklet_identity_mismatch');
  if(!Number.isSafeInteger(a.question_count) || a.question_count!==a.questions.length || a.question_count<20 ||
      new Set(a.questions.map(q=>String(q.id))).size!==a.question_count || a.questions.some((q,i)=>String(q.id)!==String(i+1)))
    throw new Error('complete_numbered_paper_required');
  for(const q of a.questions) {
    if(!q.body || q.options?.length!==4 || q.quotes?.length!==copies.length || q.quotes.some((quote,i)=>!quote || !texts[i].includes(normalize(quote))))throw new Error('mirror_question_excerpt_required');
    if(!new RegExp(`^${q.id}[.)]?\\s`).test(normalize(q.quotes[0])))throw new Error('mirror_printed_question_id_required');
    if(new Set(q.quotes.map(normalize)).size!==1)throw new Error('mirror_question_content_disagreement');
    let offset=normalize(q.quotes[0]).indexOf(normalize(q.body));
    if(offset<0)throw new Error('mirror_question_stem_mismatch');
    offset+=normalize(q.body).length;
    for(const option of q.options) {
      const value=normalize(typeof option==='string'?option:option.text),at=normalize(q.quotes[0]).indexOf(value,offset);
      if(!value || at<offset)throw new Error('mirror_option_order_mismatch');offset=at+value.length;
    }
    if(q.passage_text && copies.some((_copy,i)=>!texts[i].includes(normalize(q.passage_text))))throw new Error('mirror_passage_mismatch');
  }
  return a;
}
export function matchMirroredAnchor(anchor,paper,key,keyText) {
  const a=paper.authentication;if(a?.type!=='corroborated_mirror')return;
  const q=a.questions.find(q=>String(q.id)===String(anchor.official_question_id)),identity=a.identity;
  const context=anchor.authentication?.key_context_quote;
  if(!q || normalize(q.body)!==normalize(anchor.body) || JSON.stringify(q.options.map(o=>normalize(typeof o==='string'?o:o.text)))!==JSON.stringify(anchor.options.map(o=>normalize(typeof o==='string'?o:o.text))) ||
      normalize(q.passage_text || '')!==normalize(anchor.passage_text || ''))throw new Error('corroborated_anchor_mismatch');
  if(key.kind!=='final_key' || !context || !normalize(keyText).includes(normalize(context)) ||
      ![identity.subject_code,identity.language,identity.key_date_token].every(token=>normalize(context).includes(normalize(token))) ||
      anchor.key_format!=='omr_section' || anchor.omr_booklet!==identity.booklet)
    throw new Error('official_key_subject_date_booklet_required');
}
export function omrAnswer(anchor,keyText) {
  if(anchor.key_format!=='omr_section')return null;
  const row=anchor.key_quote?.trim(),header=anchor.key_table_header_quote;
  const booklets=[...(header || '').matchAll(/Book\s*:\s*([ABCD])/g)].map(match=>match[1]);
  const values=row?.match(/DROP|MULTIPLE|\d+(?:\s*,\s*\d+)*/gi),column=anchor.key_column;
  // Q46–50 occupy the second block of each booklet on only the first five
  // printed rows. Remaining rows omit those blank cells in text extraction.
  const sparse=booklets.length===8 && values?.length===8 && booklets.every((book,i)=>book===booklets[i-i%2]);
  const cell=sparse?column/2:column;
  if(!row || !keyText.includes(row) || !header || !keyText.includes(header) || booklets.length<2 || booklets.length>8 ||
      (!sparse && values?.length!==booklets.length*2) || !Number.isSafeInteger(column) || !Number.isSafeInteger(cell) || column<0 || column>=booklets.length ||
      values[cell*2]!==String(anchor.official_question_id) || booklets[column]!==anchor.omr_booklet || anchor.authentication?.option_order_checked!==true)
    throw new Error('exact_omr_booklet_row_required');
  return values[cell*2+1].replace(/\s/g,'').toUpperCase();
}
