import {hashJSON} from '../../../../../../../data/question_factory_policy.mjs';
import {responseJSON} from '../../../../../../../scripts/pipeline/lib/factoryTransport.mjs';

export const C_AUTHOR_FORMAT_CONTRACT='registered-cuet-brief-format-c1';

export function constrainAuthorFormatC(body,job){
  const revised=structuredClone(body),schema=revised.text?.format?.schema;
  if(!job?.format||!schema?.properties?.question_type?.enum?.includes(job.format))throw Error('candidate_c_supported_requested_format_required');
  const numerical=job.format==='numerical_calculation',passage=Boolean(job.passage_text);
  if(numerical&&passage)throw Error('candidate_c_conflicting_numerical_passage_brief');
  schema.properties.question_type.enum=[job.format];
  if(numerical)schema.properties.route.enum=['numerical'];
  if(passage)schema.properties.route.enum=['passage'];
  const system=revised.input?.find(row=>row.role==='system');
  if(!system)throw Error('candidate_c_author_system_required');
  system.content=system.content.replace('If the requested numerical task is unsupported by this topic, produce a supported conceptual task and state the actual format honestly.',
    'Preserve the requested question format. For a numerical brief, use a computation justified by the supplied definitions or formulas and explicit original stem data. Do not substitute a conceptual question to avoid computation. Unsupported source material cannot establish an answer.');
  system.content+=' The registered brief format is mandatory; question_type must equal '+job.format+'. A numerical brief requires numerical route and an actual calculation. These format constraints do not prove correctness, source entailment or difficulty; independent gates still decide those.';
  return revised;
}

export function authorFormatC(transport,job){
  return {generate:async(provider,body,options)=>{
    if(provider!=='openai'||options?.stage!=='authoring')return transport.generate(provider,body,options);
    const revised=constrainAuthorFormatC(body,job),key=hashJSON({contract:C_AUTHOR_FORMAT_CONTRACT,prior_key:options.key,body:revised});
    const response=await transport.generate(provider,revised,{...options,key}),authored=responseJSON(response);
    if(authored.question_type!==job.format||job.format==='numerical_calculation'&&authored.route!=='numerical'||job.passage_text&&authored.route!=='passage')
      throw Error('candidate_c_author_requested_format_mismatch');
    return response;
  }};
}
