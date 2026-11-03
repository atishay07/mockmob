// Shared read-only pagination for the worker and protected admin endpoints.
export async function readAllRows(db, table, select='*', order='id') {
  const rows=[];
  let pageSize=1000;
  for(let offset=0;;) {
    const {data,error}=await db.from(table).select(select).order(order).range(offset,offset+pageSize-1);
    // An evidence-heavy page can exceed the database statement timeout. Retry
    // only this idempotent read once at a smaller page size; never truncate rows.
    if(error?.code==='57014'&&table==='questions'&&select==='*'&&pageSize===1000){pageSize=100;continue;}
    if(error)throw new Error(`factory_storage_unavailable:${error.code}`);
    rows.push(...data);if(data.length<pageSize)break;
    offset+=pageSize;
  }
  return rows;
}
export async function attachBankPassages(db, rows) {
  const ids=[...new Set(rows.map(q=>q.passage_group_id || q.passage_id).filter(Boolean))];
  const passages=new Map();
  for(let i=0;i<ids.length;i+=100) {
    const {data,error}=await db.from('passage_groups').select('id,passage_text').in('id',ids.slice(i,i+100));
    if(error)throw new Error(`passage_read_failed:${error.code}`);
    for(const p of data)passages.set(p.id,p.passage_text);
  }
  return rows.map(q=>({...q,passage_text:q.passage_text || passages.get(q.passage_group_id || q.passage_id) || null}));
}
export async function readBankSnapshot(db) {return attachBankPassages(db,await readAllRows(db,'questions'));}
