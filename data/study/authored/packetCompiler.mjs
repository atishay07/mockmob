import { unitBase, makeCard, choice } from './helpers.mjs';

export function packetNumber(c) {
  if(c.op==='revenue_deficit') return c.expenditure-c.receipts;
  if(c.op==='fiscal_deficit') return c.expenditure-c.revenue-c.capital;
  if(c.op==='primary_deficit') return c.fiscal-c.interest;
  if(c.op==='liquidity_ratio') return c.assets/c.liabilities;
  if(c.op==='quick_assets') return c.assets-c.inventory-c.prepaid;
  throw new Error('UNSUPPORTED_PACKET_CALCULATION');
}

// Author one checked concept packet; compile its teaching, questions, recall and print data.
// Nothing is produced by a paid model, and this compiler does not publish content.
export function compilePacket(packet) {
  if(packet.facts.length<3 || new Set(packet.facts.map(f=>f.label)).size!==packet.facts.length) throw new Error('INVALID_PACKET_FACTS');
  const ref={id:`ncert-${packet.source}`,url:`https://ncert.nic.in/textbook/pdf/${packet.source}.pdf`,label:packet.sourceLabel,permission:'reference only; MockMob explanations and scenarios are original'};
  const unit=unitBase({id:packet.id,version:packet.version || 1,subject:packet.subject,chapter:packet.chapter,conceptId:packet.id,order:30,
    title:packet.title,summary:packet.summary,minutes:5,skill:packet.skill,objectives:packet.facts.map(f=>`Recognise and apply ${f.label.toLowerCase()}`),
    examLink:'Use the distinguishing feature in the question. These are original learning activities, separate from timed chapter practice.',sourceRefs:[ref]});
  unit.packetId=packet.id;
  unit.sourceEvidence=packet.facts.map(f=>[ref.id,f.page,[f.anchor]]);
  const labels=packet.facts.map(f=>f.label);
  const checked=(fact,i)=>choice(`${fact.case} Which concept is being used?`,labels,i,fact.why,{optionNotes:labels.map((_,j)=>j===i ? null : `This describes ${fact.label.toLowerCase()}: ${fact.definition}`)});
  unit.blocks=[
    {id:'idea',type:'reading',kind:'explanation',title:'What to look for',body:packet.summary},
    {id:'contrast',type:'reading',kind:'contrast',title:'Three ideas, compared',rows:[['Concept','Keep this distinction'],...packet.facts.map(f=>[f.label,f.definition])]},
    {id:'decision',type:'reading',kind:'diagram',title:'Recognise the clue',flow:packet.facts.map(f=>({label:f.label,detail:f.cue}))},
    ...packet.facts.map((f,i)=>({id:`example-${i}`,type:'reading',kind:'worked_example',title:`Apply ${f.label.toLowerCase()}`,body:`${f.case}\n\n${f.why}`,note:f.cue,...(f.calculation ? {formula:`Answer: ${packetNumber(f.calculation)}`,calc:{...f.calculation,expect:String(packetNumber(f.calculation))}} : {})})),
    {id:'trap',type:'reading',kind:'mistake',title:'Avoid the usual mix-up',body:packet.trap},
    ...packet.facts.slice(0,2).map((f,i)=>({id:`check-${i}`,kind:'knowledge_check',title:'Try the distinction',...checked(f,i)}))
  ];
  const cards=packet.facts.map((f,i)=>makeCard(unit,{id:`${unit.id}-fact-${i+1}`,version:unit.version,objective:`Distinguish ${f.label.toLowerCase()} from the neighbouring concepts`,title:f.label,cue:f.cue,variants:[
    choice(f.definition+' Which concept is this?',labels,i,f.why,{optionNotes:labels.map((_,j)=>j===i ? null : `Compare the definitions: ${f.definition}`)}),
    f.calculation ? {type:'numeric',prompt:f.case+' Calculate the result.'+(f.calculation.op==='liquidity_ratio'?' Enter a number, for example 2 for 2:1.':''),answer:String(packetNumber(f.calculation)),explanation:f.why,calc:f.calculation}
      : {type:'reveal',prompt:`Explain ${f.label.toLowerCase()} in your own words, and give its distinguishing feature.`,answer:f.definition,explanation:f.why}
  ]}));
  return {units:[unit],cards};
}
