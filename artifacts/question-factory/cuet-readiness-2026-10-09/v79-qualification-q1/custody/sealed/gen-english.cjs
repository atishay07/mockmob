const fs=require('fs');
const base='C:/Users/atish/AppData/Local/Temp/claude/C--Users-atish-Desktop-mockmob-copy-mockmob-copy/25c3edf2-b29c-4fc7-9e35-73be4428aee6/scratchpad/v79-fresh/';
const facts=Object.fromEntries(JSON.parse(fs.readFileSync(base+'kit/english-facts.json','utf8')).map(f=>[f.ref,f]));
const RC='Reading Comprehension';
const LO=(o)=>({syllabus_unit:RC,objective:o,target_term:''});
function item(id,valid,cat,ev,ref,o){
  const f=facts[ref];
  return {local_id:id,expected_valid:valid,defect_category:cat,defect_evidence:ev,candidate:{subject:'english',chapter:f.chapter,body:o.q,passage_text:f.text,
  options:o.opts.map((t,i)=>({key:'ABCD'[i],text:t})),correct_answer:o.key,explanation:o.exp,difficulty:o.diff,question_type:'reading_comprehension',route:'passage',
  learning_objective:LO(o.lo),fact_refs:[ref]}};
}
const items=[
item('english-v1',true,null,null,'F1',{q:'According to the passage, what were students required to do each Friday during the trial?',
 opts:["Borrow two new books and grade the librarian's records",'Return at least one book and write a short note about it','Return both books and discuss the notes with the librarian','Write a graded note on every book borrowed that week'],key:'B',diff:'easy',
 exp:'The passage states that each Friday students returned at least one book and wrote a short note about it. They could borrow two books at a time, but returning both was not required. The librarian did not grade the notes, and discussing notes was only a later proposal.',
 lo:'Identify specific factual details stated in a passage'}),
item('english-v2',true,null,null,'F2',{q:'Why did the report recommend comparing cups used per student before crediting the lending scheme for the larger fall in the second week?',
 opts:['Most borrowed cups were never returned, so the figures were unreliable','Disposable-cup use had not fallen at all during the first week','Lower attendance in the second week could by itself have reduced total cup use','The washable cups were issued without any refundable deposit'],key:'C',diff:'medium',
 exp:'The passage says attendance was lower in the second week because one class was away, so fewer students could mean fewer cups used regardless of the scheme. Hence the report asked for a per-student comparison. The other options are contradicted: use fell in both weeks, most borrowed cups were returned, and a refundable deposit was charged.',
 lo:'Draw inferences about the reasoning behind a conclusion in a passage'}),
item('english-v3',true,null,null,'F5',{q:"Which statement best explains the grandfather's remark, \"A promise includes care\"?",
 opts:['Keeping a promise to bring the radio home includes protecting it, even if that means arriving late','Keeping a promise means reaching home before sunset whatever condition the radio is in','Mira should have asked the repairer to leave the electrical work unfinished','Mira should not have told him about the delay'],key:'A',diff:'medium',
 exp:'Mira waited until the case was dry and covered the radio in the rain, accepting that she would miss sunset, and her grandfather approved. So he means that a promise covers looking after the radio, not just meeting the deadline. The passage says the electrical work was finished, and Mira deliberately telephoned to explain the delay.',
 lo:"Infer the implied meaning of a character's statement in a narrative passage"}),
item('english-v4',true,null,null,'F10',{q:'What contrast does the tea seller notice for the first time at the end of the passage?',
 opts:['The trains had stopped running, just like the station clock','Travellers trusted the station clock more than their own watches','The clock was within his reach but he chose not to correct it','The still clock hands stood above a station where almost everything was moving'],key:'D',diff:'medium',
 exp:'The last sentence states the hands stood still above a place where almost everything was moving, which the tea seller notices after the child watches the passing train. The trains were running, travellers checked their watches rather than relying on the clock, and the clock was beyond his reach.',
 lo:'Interpret theme and contrast in a literary passage'}),
item('english-v5',true,null,null,'F3',{q:'In the passage, the phrase "a scarce facility" most nearly refers to something that is',
 opts:['available in large numbers, so any group can use it whenever it wishes','limited in supply, so access to it has to be shared among users','kept for meetings longer than thirty minutes only','open only to regular visitors of the reading room'],key:'B',diff:'easy',
 exp:'The reading room had a single discussion table, and reservation slots were introduced to share access to it, so "scarce" means limited in supply. The passage says unreserved time was open to any visitor, and meetings longer than thirty minutes were moved to a separate room.',
 lo:'Infer the meaning of words and phrases from context'}),
item('english-d1',false,'wrong_key','Recorded key is B ("Volunteers did not record how often each group asked for directions"), but the passage says volunteers recorded this; the supported answer is C (maps were handed out on different days when different galleries were open). The explanation also wrongly endorses B.','F4',{q:'According to the passage, why could the first trial not separate the effect of lettering from other influences?',
 opts:['Both map versions were given out on the same day','Volunteers did not record how often each group asked for directions','Maps were handed out on different days, when different galleries were open','Visitors who received larger lettering asked for directions more often'],key:'B',diff:'medium',
 exp:"The passage indicates that the volunteers' records were incomplete, so the trial could not isolate the effect of the lettering. The other options describe features that the passage does not report.",
 lo:'Identify reasons given for a conclusion in a passage'}),
item('english-d2',false,'second_defensible_option','Options A and B are both stated in the passage: most pages were blank expense tables (A), and Kabir wanted something to read that evening (B). Keyed A only, so B is equally defensible.','F8',{q:'Why did Kabir put back the travel diary?',
 opts:['Most of its pages were blank tables for recording expenses','He wanted something to read that evening','He no longer liked the look of its cover','His sister had told him it was too expensive'],key:'A',diff:'medium',
 exp:'On opening it, Kabir found most pages held blank tables for recording expenses. The cover was what attracted him in the first place, and the passage mentions no advice from his sister about price.',
 lo:"Identify reasons for a character's decision in a narrative passage"}),
item('english-d3',false,'unsupported_explanation','Key C is correct, but the explanation claims Nila wore insulated gloves and that the technician charged a fee; neither detail appears in the passage.','F7',{q:'What did Nila do as soon as she noticed that the lamp flickered whenever its cable moved?',
 opts:['She carried it straight to the community hall','She replaced the damaged cable herself','She switched off the power and asked the technician to inspect it','She told the organiser the delivery would be early'],key:'C',diff:'easy',
 exp:'Nila switched off the power and asked the technician to inspect the lamp. She wore insulated gloves while doing so, and the technician charged a small fee to replace the cable. The delivery was delayed, not early, and she carried the lamp to the hall only after it had been repaired.',
 lo:'Identify sequence of events in a narrative passage'}),
item('english-d4',false,'unanswerable_from_passage','The passage says only that the manager agreed to repeat the demonstration "in the afternoon"; it gives no start time, so the keyed answer D (2 p.m.) cannot be derived from the passage.','F6',{q:'At what time did the repeated demonstration begin at the observatory?',
 opts:['1 p.m.','12 noon','3 p.m.','2 p.m.'],key:'D',diff:'medium',
 exp:'The manager agreed to repeat the morning demonstration in the afternoon, after the class had examined the exhibition, and the repeat began at 2 p.m. The other times fall outside this schedule.',
 lo:'Locate specific details in a passage'})
];
fs.writeFileSync(base+'sealed/english-authored.json',JSON.stringify({subject:'english',items},null,1));
