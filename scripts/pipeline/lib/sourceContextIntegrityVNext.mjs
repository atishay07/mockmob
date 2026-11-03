import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute} from 'node:path';

export const SOURCE_CONTEXT_CONTRACT='ncert-teaching-context-vnext-2';
const normalized=text=>text.normalize('NFKC').replace(/[\s\u0000-\u001f]+/g,' ').trim();
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function loadVerifiedPageContext(source,{runtimeDirectory='data/question-factory-runtime',read=readFileSync}={}){
  const base=resolve(runtimeDirectory),workspace=resolve('.'),inside=path=>{const prefixed=/^(?:data|artifacts)[\\/]/.test(path),anchor=prefixed?workspace:base,full=resolve(anchor,path),rel=relative(anchor,full);if(rel.startsWith('..')||isAbsolute(rel))throw Error('context_file_outside_runtime');return full;};
  if(!source?.file||!source.extraction_file||!source.identity_sha256||!source.extraction_sha256)throw Error('registered_document_and_extraction_identity_required');
  const pdf=read(inside(source.file)),extraction=read(inside(source.extraction_file));
  if(sha256(pdf)!==source.identity_sha256||sha256(extraction)!==source.extraction_sha256)throw Error('context_document_or_extraction_changed');
  const columns=source.extraction_file.endsWith('.column-normalized.txt');
  const pagePath=source.file.replace(/\.pdf$/i,columns?'.column-pages.json':'.pages.json');if(pagePath===source.file)throw Error('pdf_page_context_required');
  const raw=JSON.parse(read(inside(pagePath),'utf8'));
  let firstPage=1,pages=raw;
  if(columns){
    const meta=JSON.parse(read(inside(source.file.replace(/\.pdf$/i,'.column-metadata.json')),'utf8'));
    // This retained extractor deliberately excludes the opening case/objectives
    // page. Its first teaching page was checked in the actual PDF on 8 October.
    if(source.id!=='ncert-lebs107'||meta.identity_sha256!==source.identity_sha256||meta.extraction_sha256!==source.extraction_sha256||!meta.visually_checked_pdf_pages_1based?.includes(2)||!Array.isArray(raw)||raw[0]?.pdf_page_1based!==2)throw Error('verified_column_page_context_required');
    firstPage=2;pages=raw.map(p=>{if(!Array.isArray(p.columns)||p.columns.length!==2||p.columns.some(c=>typeof c!=='string'))throw Error('invalid_column_page_context');return{page:p.pdf_page_1based,text:p.columns.join(' ')};});
  }
  const whole=Array.isArray(pages)?pages.map(p=>p.text).join(' '):'',marked=Array.isArray(pages)?pages.map(p=>`PAGE ${p.page} ${p.text}`).join(' '):'';
  // Some retained extractors prefixed each physical page with PAGE n. Match
  // that exact deterministic representation; never strip arbitrary source text.
  if(!Array.isArray(pages)||![whole,marked].some(text=>normalized(text)===normalized(extraction.toString('utf8'))))throw Error('context_pages_not_registered_extraction');
  teachingIntervals(pages,{firstPage});
  return {pages,first_page:firstPage,document_sha256:source.identity_sha256,extraction_sha256:source.extraction_sha256,page_text_sha256:sha256(Buffer.from(JSON.stringify(pages)))};
}

export function deriveNormativeRegistry(registry,{runtimeDirectory='data/question-factory-runtime'}={}){
  const derived=structuredClone(registry),eligibleLocators={},reports=[];
  for(const source of Object.values(derived.sources).filter(s=>s.id.startsWith('ncert-')&&s.kind==='reference'&&s.state==='active')){
    let context;try{context=loadVerifiedPageContext(source,{runtimeDirectory});}catch(error){reports.push({id:source.id,state:'context_unresolved',reason:error.message});eligibleLocators[source.id]=[];continue;}
    const parents=Object.entries(source.facts),added=[];source.normative_context||={};
    for(const[locator]of parents){
      const result=normativeFactSpans(source,locator,context.pages,{firstPage:context.first_page});
      for(const span of result.spans){
        const key='teaching-context-'+hashJSON({parent:locator,start:span.page_start,end:span.page_end,hash:span.support_hash}).slice(0,24);
        source.facts[key]={text:span.text};source.supports[key]=span.support_hash;
        source.normative_context[key]={contract:SOURCE_CONTEXT_CONTRACT,...context, pages:undefined,...span,text:undefined};added.push(key);
      }
    }
    eligibleLocators[source.id]=[...new Set(added)];reports.push({id:source.id,state:added.length?'derived':'context_unresolved',parent_facts:parents.length,teaching_spans:eligibleLocators[source.id].length});
  }
  return {registry:derived,eligible_locators:eligibleLocators,reports,contract:SOURCE_CONTEXT_CONTRACT,original_sources_preserved:true};
}
const exercise=/\b(?:[Tt]est\s+[Yy]our\s+[Uu]nderstanding|TEST\s+YOUR\s+UNDERSTANDING|Exercises|EXERCISES|Do\s+It\s+Yourself|DO\s+IT\s+YOURSELF|Short\s+Answer\s+Type|SHORT\s+ANSWER\s+TYPE|Long\s+Answer\s+Type|LONG\s+ANSWER\s+TYPE)\b/g;
// NCERT section numbering marks the return to teaching after a continued
// exercise. Numbered exercise entries such as (vi) or 2. cannot reset it.
const teaching=/\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s+[A-Z][A-Za-z][A-Za-z ,’'&:-]{3,}/g;

export function teachingIntervals(pages,{firstPage=1}={}) {
  if(!Array.isArray(pages)||!pages.length)throw Error('adjacent_extracted_pages_required');
  let mode='teaching',previous=firstPage-1;
  return pages.map(page=>{
    if(!Number.isInteger(page.page)||page.page!==previous+1||typeof page.text!=='string')throw Error('contiguous_page_context_required');
    previous=page.page;
    const events=[...page.text.matchAll(exercise)].map(m=>({at:m.index,mode:'exercise'}))
      .concat([...page.text.matchAll(teaching)].map(m=>({at:m.index,mode:'teaching'})))
      .sort((a,b)=>a.at-b.at);
    const intervals=[];let start=0;
    for(const event of events){if(mode==='teaching'&&event.at>start)intervals.push({start,end:event.at});mode=event.mode;start=event.at;}
    if(mode==='teaching'&&page.text.length>start)intervals.push({start,end:page.text.length});
    return {page:page.page,text:page.text,intervals,ending_mode:mode};
  });
}

// Select exact teaching substrings. This proves their document context only;
// lexical relevance, claim entailment and the answer still need validation.
export function normativeFactSpans(source,locator,pages,{firstPage=1}={}) {
  const fact=source?.facts?.[locator],text=fact?.text;
  if(!source?.identity_sha256||source.extraction_checked!==true||!source.reuse_permitted||typeof text!=='string'||hashJSON(text)!==source.supports?.[locator])throw Error('authenticated_context_reference_required');
  const context=teachingIntervals(pages,{firstPage}),matches=[];
  const requested=locator.match(/^pdf-page-(\d+)$/)?.[1];
  const ranges=new Map();
  for(const page of context){const at=page.text.indexOf(text);if(at>=0)ranges.set(page.page,{start:at,end:at+text.length});}
  // Retained section excerpts may cross a PAGE n marker or a physical page.
  // Locate the entire authenticated parent, then keep only exact substrings
  // of real page text. Normalization is for location, never for new evidence.
  if(!ranges.size&&!requested){
    const needle=normalized(text);
    for(const marked of [false,true]){
      const mapped=mappedDocument(pages,marked),at=mapped.text.indexOf(needle);
      if(at<0||mapped.text.indexOf(needle,at+1)>=0)continue;
      for(let i=at;i<at+needle.length;i++){
        const pos=mapped.positions[i];if(!pos)continue;
        const range=ranges.get(pos.page)||{start:pos.start,end:pos.end};range.start=Math.min(range.start,pos.start);range.end=Math.max(range.end,pos.end);ranges.set(pos.page,range);
      }
      break;
    }
  }
  for(const page of context){
    if(requested&&page.page!==Number(requested))continue;
    const range=ranges.get(page.page);if(!range)continue;
    for(const interval of page.intervals){
      const start=Math.max(range.start,interval.start),end=Math.min(range.end,interval.end);
      if(end<=start)continue;
      const excerpt=page.text.slice(start,end);
      if(excerpt.trim().length<80)continue;
      matches.push({text:excerpt,page:page.page,page_start:start,page_end:end,parent_locator:locator,parent_support_hash:source.supports[locator],support_hash:hashJSON(excerpt)});
    }
  }
  return {contract:SOURCE_CONTEXT_CONTRACT,state:matches.length?'teaching_spans_available':'context_unresolved',spans:matches};
}

const mappedCache=new WeakMap();
function mappedDocument(pages,marked){
  let cache=mappedCache.get(pages);if(!cache){cache={};mappedCache.set(pages,cache);}if(cache[marked])return cache[marked];
  const chars=[],positions=[];
  function add(value,page=null){let offset=0;for(const original of value){const end=offset+original.length;for(const char of original.normalize('NFKC')){const c=/[\s\u0000-\u001f]/.test(char)?' ':char;if(c===' '&&(!chars.length||chars.at(-1)===' '))continue;chars.push(c);positions.push(page===null?null:{page,start:offset,end});}offset=end;}}
  for(const p of pages){add(marked?` PAGE ${p.page} `:' ');add(p.text,p.page);}
  while(chars.at(-1)===' '){chars.pop();positions.pop();}
  return cache[marked]={text:chars.join(''),positions};
}

export function quoteInTeachingContext(source,locator,quote,pages) {
  if(typeof quote!=='string'||!quote.trim())return false;
  return normativeFactSpans(source,locator,pages).spans.some(span=>span.text.includes(quote));
}
