import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalStudyJSON} from '../../data/study_content.js';
const content=JSON.parse(readFileSync('data/study/pilot.json','utf8'));
const release=JSON.parse(readFileSync('data/study/release.json','utf8'));
const current=content.units.filter(u=>release.units[`${u.id}@${u.version}`]?.contentHash===createHash('sha256').update(canonicalStudyJSON(u)).digest('hex'));
const subjects=content.syllabus.map(s=>({subject:s.subject,totalChapters:s.chapters.length,chapters:s.chapters.map(c=>({chapter:c.title,status:current.some(u=>u.subject===s.subject&&u.chapter===c.title)?'partial':'no_lessons',lessons:current.filter(u=>u.subject===s.subject&&u.chapter===c.title).map(u=>u.id)}))}));
const report={at:new Date().toISOString(),lessons:current.length,cards:Object.keys(release.cards).length,chaptersWithLessons:subjects.reduce((n,s)=>n+s.chapters.filter(c=>c.status==='partial').length,0),totalChapters:subjects.reduce((n,s)=>n+s.totalChapters,0),subjects,
  next:subjects.flatMap(s=>s.chapters.filter(c=>c.status==='no_lessons').map(c=>({subject:s.subject,chapter:c.chapter}))),paidCalls:0,
  note:'A chapter with lessons has partial concept coverage. A passing source gate is not independent academic calibration.'};
mkdirSync('artifacts/study-suite',{recursive:true});
writeFileSync('artifacts/study-suite/coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({lessons:report.lessons,cards:report.cards,chaptersWithLessons:report.chaptersWithLessons,totalChapters:report.totalChapters,nextChapters:report.next.length,paidCalls:0}));
