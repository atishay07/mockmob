import { notFound } from 'next/navigation';
import { readFileSync } from 'node:fs';
import StudyPreview from './StudyPreview';
export const metadata={robots:{index:false,follow:false}};
export default function Preview() {
  if(process.env.NODE_ENV==='production') notFound();
  const content=JSON.parse(readFileSync(`${process.cwd()}/data/study/pilot.json`,'utf8'));
  return <StudyPreview content={content}/>;
}
