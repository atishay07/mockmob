import {createHash} from 'node:crypto';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

// service_tier is added by the native transport after the caller's persistent
// key is calculated. A receipt replay can restore precisely that field from
// the original saved realtime request. No content/bounds change is permitted.
export function exactSavedRequestBody(provider,offered,saved){
  if(saved?.body&&digest(saved.body)===digest(offered))return saved.body;
  if(provider==='openai'&&saved?.config?.provider==='openai'&&saved.config.execution_mode==='realtime'&&offered?.service_tier===undefined&&saved?.body?.service_tier==='flex'){
    const withoutTier=structuredClone(saved.body);delete withoutTier.service_tier;
    if(digest(withoutTier)===digest(offered))return saved.body;
  }
  throw Error('saved_request_content_mismatch');
}
