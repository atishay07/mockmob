import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {sealPractice,openPractice,practiceId} from '../practice_ticket.js';
const secret='staging-test-practice-secret-32-characters',now=Date.now();
const row={id:'paper',user_id:'student',created_at:new Date(now).toISOString(),expires_at:new Date(now+3600000).toISOString(),questions:Array.from({length:50},(_,i)=>({id:String(i),body:'Solve this supported question',options:['A','B','C','D'],correct_answer:'B',evidence:{record:{checks:'Independent supporting excerpt and verification contract. '.repeat(600)}}}))};
function encrypted(bytes,version){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update(`mockmob-practice-v1:${secret}`).digest(),iv);cipher.setAAD(Buffer.from(version==='p1'?'mockmob-practice-v1':'mockmob-practice-v2'));const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);return[version,iv.toString('base64url'),ciphertext.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');}
test('a full paper with large verification records fits submission while retaining the exact authenticated snapshot',()=>{
 assert.ok(Buffer.byteLength(JSON.stringify(row))>600000);const ticket=sealPractice(row,secret);assert.ok(ticket.length<500000);assert.ok(JSON.stringify({sessionTicket:ticket,sessionId:row.id,answers:{},events:[]}).length<600000);assert.deepEqual(openPractice(ticket,secret,'student',now),row);
});
test('existing p1 tickets remain readable and practice request identities do not change',()=>{
 const small={...row,questions:row.questions.slice(0,1)},ticket=encrypted(Buffer.from(JSON.stringify(small)),'p1');assert.deepEqual(openPractice(ticket,secret,'student',now),small);assert.equal(practiceId(secret,'student','stable-key',['english','full',50]),practiceId(secret,'student','stable-key',['english','full',50]));
});
test('tampering, version substitution, wrong owner, wrong secret and expiry remain rejected',()=>{
 const ticket=sealPractice(row,secret),parts=ticket.split('.');parts[2]=(parts[2][0]==='a'?'b':'a')+parts[2].slice(1);assert.throws(()=>openPractice(parts.join('.'),secret,'student',now),/INVALID_PRACTICE_SESSION/);assert.throws(()=>openPractice(ticket.replace(/^p2/,'p1'),secret,'student',now),/INVALID_PRACTICE_SESSION/);assert.throws(()=>openPractice(ticket,secret,'other',now),/SESSION_NOT_FOUND/);assert.throws(()=>openPractice(ticket,secret+'wrong','student',now),/INVALID_PRACTICE_SESSION/);assert.throws(()=>openPractice(ticket,secret,'student',now+3800000),/SESSION_EXPIRED/);
});
test('snapshot and decompression bounds reject oversized data',()=>{
 assert.throws(()=>sealPractice({...row,oversized:'x'.repeat(8*1024*1024)},secret),/PRACTICE_SNAPSHOT_TOO_LARGE/);const bomb=encrypted(deflateRawSync(Buffer.from('x'.repeat(8*1024*1024+1))),'p2');assert.throws(()=>openPractice(bomb,secret,'student',now),/INVALID_PRACTICE_SESSION/);
});
