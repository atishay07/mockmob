import { randomUUID } from 'node:crypto';
import { authorCandidate } from './factoryCore.mjs';

// Authoring only: candidates still need blind checks and signed publication.
// No legacy provider, API-key fallback or duplicate evasion.
export async function generateVariants(baseQuestion,count=3,context={}) {
  if(!context.registry || !context.transport || !Number.isInteger(count) || count<1 || count>5)throw new Error('authenticated_factory_context_required');
  const anchorId=baseQuestion.provenance?.anchor_id || baseQuestion.id;
  const anchor=context.registry.examples?.find(a=>a.id===anchorId);
  if(!anchor)throw new Error('authenticated_anchor_required');
  if(anchor.passage_group_id)throw new Error('complete_passage_group_job_required');
  const candidates=[];
  for(let i=0;i<count;i++)candidates.push(await authorCandidate({id:randomUUID(),subject:anchor.subject,chapter:anchor.chapter,anchor_id:anchor.id,kind:'pyq_adapted'},context));
  return candidates;
}
