import {quotesInReferences} from './factoryCore.mjs';
import {sourceMaterial} from './factoryEvidence.mjs';

export function originalQuoteIntegrity(candidate,registry){
 const quotes=candidate?.evidence_quotes;
 if(!Array.isArray(quotes)||!quotes.length)return {passed:false,reason:'author_evidence_quotes_missing'};
 const references=sourceMaterial(registry,candidate.source_refs||[]);
 const verified=quotesInReferences(quotes,references);
 return {passed:verified.length===quotes.length,reason:verified.length===quotes.length?null:'author_evidence_quote_not_in_sources',supplied:quotes.length,verified:verified.length};
}
