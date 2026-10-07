import test from 'node:test';import assert from 'node:assert/strict';
import {boundedRowChunks} from '../lib/boundedStorage.mjs';
import {readAllRows} from '../lib/bankSnapshot.mjs';

test('storage chunks retain every UTF-8 evidence byte and isolate oversized records',()=>{
 const rows=[{id:1,evidence:'₹'.repeat(40)},{id:2,evidence:'x'.repeat(500)},{id:3,evidence:'valid'}];
 const chunks=boundedRowChunks(rows,{maximumRows:25,maximumBytes:180});
 assert.deepEqual(chunks.flat(),rows);assert.deepEqual(chunks.map(c=>c.length),[1,1,1]);
 assert.equal(chunks[1][0].evidence.length,500);
 assert.deepEqual(boundedRowChunks([]),[]);
 assert.throws(()=>boundedRowChunks(rows,{maximumRows:0}),/invalid_storage_bounds/);
});
test('many small storage records obey row and byte bounds without losses',()=>{
 const rows=Array.from({length:100},(_,id)=>({id,state:'published'}));
 const chunks=boundedRowChunks(rows,{maximumRows:7,maximumBytes:180});
 assert.deepEqual(chunks.flat(),rows);
 assert.ok(chunks.every(c=>c.length<=7&&Buffer.byteLength(JSON.stringify(c))<=180));
});
function fixture(rows){const calls=[];return {calls,db:{from(table){return{select(select){return{order(order){return{async range(start,end){calls.push({table,select,order,start,end});return{data:rows.slice(start,end+1),error:null};}};}};}};}}};}
test('full snapshots reduce timed-out pages without dropping or repeating boundary rows',async()=>{
 const rows=Array.from({length:1201},(_,id)=>({id,evidence:{exact:'retained'}})),calls=[];
 const db={from:()=>({select:()=>({order:()=>({range:async(start,end)=>{
  calls.push([start,end]);return start===1000&&end===1999?{error:{code:'57014'},data:null}:{data:rows.slice(start,end+1),error:null};
 }})})})};
 assert.deepEqual(await readAllRows(db,'questions'),rows);
 assert.deepEqual(calls,[[0,999],[1000,1999],[1000,1099],[1100,1199],[1200,1299]]);
});
test('small metadata projections retain normal pagination and storage errors fail closed',async()=>{
 const rows=Array.from({length:1001},(_,id)=>({id})),f=fixture(rows);
 assert.deepEqual(await readAllRows(f.db,'questions','id'),rows);
 assert.deepEqual(f.calls.map(c=>[c.start,c.end]),[[0,999],[1000,1999]]);
 const db={from:()=>({select:()=>({order:()=>({range:async()=>({data:null,error:{code:'57014'}})})})})};
 await assert.rejects(readAllRows(db,'questions'),/factory_storage_unavailable:57014/);
});
