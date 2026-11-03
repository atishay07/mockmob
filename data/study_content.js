// Canonical JSON for PostgreSQL jsonb round trips (object key order is not preserved).
export function canonicalStudyJSON(value) {
  if(Array.isArray(value)) return `[${value.map(canonicalStudyJSON).join(',')}]`;
  if(value && typeof value==='object') return `{${Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${canonicalStudyJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
