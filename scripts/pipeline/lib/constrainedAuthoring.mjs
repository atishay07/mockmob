import {hashJSON} from '../../../data/question_factory_policy.mjs';
export const QUOTE_AUTHOR_CONTRACT='original-exact-quote-selection-v3';
export const LEGACY_QUOTE_AUTHOR_CONTRACT='original-exact-quote-selection-v2';

function legacyQuoteCatalog(references){
 const quotes=[];
 for(const r of references.filter(r=>r.kind!=='paper')){
  const text=String(r.text||'');
  if(text.length>=25&&text.length<=320){quotes.push(text);continue;}
  // Exact source substrings, never paraphrased quotations or claimed citations.
  for(let start=0;start<text.length&&quotes.length<24;){
   let end=Math.min(start+320,text.length);
   if(end<text.length){const stop=text.lastIndexOf(' ',end);if(stop>start+160)end=stop;}
   const quote=text.slice(start,end).trim();if(quote.length>=25)quotes.push(quote);start=end;
  }
 }
 return [...new Set(quotes)].slice(0,24);
}

export function authorQuoteCatalog(references){
 // Strict structured-output enums reject newline literals. Select contiguous
 // source lines rather than normalizing quotations and inventing exact quotes.
 return legacyQuoteCatalog(references.flatMap(r=>String(r.text||'').split(/[\u0000-\u001f]+/).map(text=>({...r,text}))))
  .filter(q=>!/[\u0000-\u001f]/.test(q));
}

// Generation-only constraint. Blinded solving, support, repair, scoring and
// publication contracts are unchanged. Older preregistrations pass through
// byte-for-byte, preserving their accepted request IDs and measured failures.
export function constrainedAuthoring(transport,job){
 if(![QUOTE_AUTHOR_CONTRACT,LEGACY_QUOTE_AUTHOR_CONTRACT].includes(job.author_contract))return transport;
 return {generate:async(provider,body,options)=>{
  if(provider!=='openai'||options?.stage!=='authoring')return transport.generate(provider,body,options);
  const revised=structuredClone(body),user=revised.input.find(r=>r.role==='user'),input=JSON.parse(user.content);
  const contract=job.author_contract,catalog=(contract===LEGACY_QUOTE_AUTHOR_CONTRACT?legacyQuoteCatalog:authorQuoteCatalog)(input.references||[]);if(!catalog.length)throw Error('author_exact_quote_catalog_missing');
  revised.text.format.schema.properties.evidence_quotes.items.enum=catalog;
  revised.input.find(r=>r.role==='system').content+=' Select evidence_quotes from the supplied schema choices exactly. A selectable quote is only a source-location constraint: it does not establish that your answer or explanation follows from it. Choose a supported task and state its decisive case assumptions. Prefer a meaningful application, inference or misconception over cosmetic restatement. Make all four choices plausible and parallel; never add difficulty by ambiguity or unsupported facts.';
  input.author_contract=contract;user.content=JSON.stringify(input);
  const key=hashJSON({contract,prior_key:options.key,body:revised});
  return transport.generate(provider,revised,{...options,key});
 }};
}
