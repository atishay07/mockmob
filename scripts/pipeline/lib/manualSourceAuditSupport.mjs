// Exact cached-source locators for construction audits, never semantic verdicts.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const auditSHA=value=>createHash('sha256').update(value).digest('hex');
export function locateAuditQuote(text,start,end){
 const normalize=value=>value.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const offsets=[],characters=[];let offset=0;
 for(const character of text){if(/[\p{L}\p{N}]/u.test(character)){characters.push(character.toLowerCase());offsets.push(offset);}offset+=character.length;}
 const normalized=characters.join(''),needle=normalize(start),endNeedle=normalize(end);
 if(!needle||!endNeedle)throw Error('nonempty_source_locator_required');
 const first=normalized.indexOf(needle),last=first<0?-1:normalized.indexOf(endNeedle,first);
 if(first<0||last<first||normalized.indexOf(needle,first+1)>=0)throw Error('source_locator_missing_or_ambiguous');
 const from=offsets[first],lastOffset=offsets[last+endNeedle.length-1];let to=lastOffset+String.fromCodePoint(text.codePointAt(lastOffset)).length;
 if(/[.;]/.test(text[to]||''))to++;
 return{quote_start:from,quote_end:to,quote:text.slice(from,to),page_text_sha256:auditSHA(text)};
}
export function cachedTeachingExcerpt(outputDir,code,page,start,end){
 const path=join(outputDir,`ncert-${code}.logical-pages-v5.json`),bytes=readFileSync(path),data=JSON.parse(bytes);
 const record=data.pages.find(p=>p.page===page);if(!record)throw Error('source_page_missing:'+code+':'+page);
 let found;try{found=locateAuditQuote(record.text,start,end);}catch(error){throw Error(`${error.message}:${code}:${page}:${start}`);}
 if(auditSHA(readFileSync(data.pdf_path))!==data.pdf_sha256)throw Error('source_pdf_identity_changed:'+code);
 return{source_id:`ncert-${code}`,cache_path:path,cache_sha256:auditSHA(bytes),physical_pdf_page:page,...found,pdf_path:data.pdf_path,pdf_sha256:data.pdf_sha256,official_url:`https://ncert.nic.in/textbook/pdf/${code}.pdf`,permission_basis:'Brief attributed official NCERT excerpts for local educational verification; no unrestricted republication claim',notice:'Quote integrity is not semantic entailment; the separate manual option-claim audit supplies the reasoning.'};
}
