export async function excludeHeldFamilies(rows,db){
 const ids=[...new Set(rows.map(q=>q.family_id || q.evidence?.record?.family_id).filter(Boolean))];
 const held=new Set();
 for(let i=0;i<ids.length;i+=300){
  const {data,error}=await db.from('recovery_family_holds').select('family_id').in('family_id',ids.slice(i,i+300));
  if(error)throw new Error('family_hold_lookup_required');
  for(const r of data || [])held.add(r.family_id);
 }
 return rows.filter(q=>!held.has(q.family_id || q.evidence?.record?.family_id));
}
