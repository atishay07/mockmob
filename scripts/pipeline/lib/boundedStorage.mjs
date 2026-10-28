// Bound database payloads, without shortening evidence or changing row contents.
export function boundedRowChunks(rows,{maximumRows=25,maximumBytes=256*1024}={}){
 if(!Number.isInteger(maximumRows)||maximumRows<1||!Number.isInteger(maximumBytes)||maximumBytes<1)throw Error('invalid_storage_bounds');
 const chunks=[];let current=[],bytes=2;
 for(const row of rows){const size=Buffer.byteLength(JSON.stringify(row),'utf8')+1;
  if(current.length&&(current.length>=maximumRows||bytes+size>maximumBytes)){chunks.push(current);current=[];bytes=2;}
  current.push(row);bytes+=size;
 }
 if(current.length)chunks.push(current);return chunks;
}
