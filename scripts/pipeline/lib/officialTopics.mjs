const bst={'Nature & Significance of Management':'I','Principles of Management':'II','Business Environment':'III','Planning':'IV','Organising':'V','Staffing':'VI','Directing':'VII','Controlling':'VIII','Financial Management':'IX','Financial Markets':'X','Marketing Management':'XI','Consumer Protection':'XII'};
const accounts={'Partnership Fundamentals':'I','Profit & Loss Appropriation Account':'I','Change in Profit Sharing Ratio':'II','Goodwill Valuation':'II','Admission of Partner':'II','Retirement & Death of Partner':'II','Dissolution of Partnership Firm':'III','Dissolution of Partnership':'III','Share Capital':'IV','Debentures':'IV','Financial Statements of Company':'V','Analysis of Financial Statements':'V','Comparative & Common Size Statements':'V','Accounting Ratios':'V','Cash Flow Statement':'V','Computerized Accounting System':'V'};
const economy={'Introduction & Theory of Consumer Behaviour':/Introduction,? Theory of Consumer Behaviour/i,'Production & Costs':/Production and Costs/i,'Theory of Firms under Perfect Competition':/firms under perfect competition/i,'Market Equilibrium & Simple Applications':/Market Equilibrium and Simple Applications/i,'National Income & Related Aggregates':/National Income Accounting/i,'Money & Banking':/Money and Banking/i,'Income Determination':/Determination of Income and Employment/i,'Government Budget & the Economy':/Government Budget and the Economy/i,'Balance of Payments':/Open Economy Macroeconomics/i,'Indian Economy on the Eve of Independence':/Development Policies and Experience/i,'Indian Economic Development 1950–1990':/Development Policies and Experience/i,'Economic Reforms Since 1991':/Economic Reforms since 1991/i,'Human Capital Formation':/Current challenges/i,'Rural Development':/Current challenges/i,'Employment':/Current challenges/i,'Environment & Sustainable Development':/Current challenges/i,'Development Experiences of India':/Development Experiences of India/i};
export function officialTopics(spec,subject,chapter){
 const text=(spec?.included_topics||[]).join(' ').replace(/\s+/g,' ').trim();
 // English has numbered sections and lettered alternatives, not "Unit I"
 // headings. Keep exact official phrases separate instead of treating its
 // entire PDF header and syllabus as one topic that no validated tag can fill.
 if(subject==='english'){
  const phrases={'Factual Passage':['Factual'],'Narrative Passage':['Narrative'],'Literary Passage':['Literary'],
   'Para Jumbles':['Rearranging the parts'],'Match the Following':['Match the following'],
   'Correct Word Usage':['Choosing the correct word'],'Vocabulary':['Synonyms','Antonyms']}[chapter]||[];
  return phrases.flatMap(phrase=>{const match=text.match(new RegExp('\\b'+phrase+'\\b','i'));return match?[match[0]]:[];});
 }
 // The official Economics document also has "Unit II Economic Reforms..."
 // without a colon after II. Do not silently merge it into the earlier unit.
 const units=text.split(/(?=\bUnit\s+[IVXLC]+\b)/i).filter(t=>/^Unit\s/i.test(t));
 let selected;
 if(subject==='business_studies')selected=units.filter(t=>new RegExp('^Unit\\s+'+bst[chapter]+'\\b','i').test(t));
 else if(subject==='accountancy')selected=units.filter(t=>new RegExp('^Unit\\s+'+accounts[chapter]+'\\b','i').test(t)&&((chapter==='Computerized Accounting System')===/Computerised Accounting System/i.test(t)));
 else if(subject==='economics')selected=units.filter(t=>economy[chapter]?.test(t.split(/[•]/)[0]));
 else selected=[text];
 if(!selected?.length)return [];
 const rows=selected.flatMap(t=>t.split(/[•]/).slice(subject==='english'?0:1)).map(t=>t.replace(/PAGE \d+/g,'').replace(/\d+\s*\|\s*P a g e/g,'').trim()).filter(t=>t.length>10&&t.length<600);
 const chapterTerms={'Human Capital Formation':/Human Capital|education|resource|growth of education/i,'Rural Development':/Rural|rural|agricultur|credit|marketing|diversif|organic/i,'Employment':/Employment|employment|unemployment|workforce|workers|informal|formal/i,'Environment & Sustainable Development':/Environment|environment|sustainab|resource|warming/i};
 return [...new Set(chapterTerms[chapter]?rows.filter(t=>chapterTerms[chapter].test(t)):rows)];
}
