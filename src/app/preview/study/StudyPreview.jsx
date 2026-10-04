"use client";
import { useMemo } from 'react';
import { AuthContext } from '@/components/AuthProvider';
import { RoleProvider } from '@/lib/roleContext';
import AppLayoutClient from '@/app/(app)/AppLayoutClient';
import StudyWorkspace from '@/components/study/StudyWorkspace';
import { createStudyRun, studyTransition, publicStudyItem, DEFAULT_PREFERENCES, preferences } from '@/../data/study_engine';

// Development-only fixture; deliberately no student storage, payment, AI, or assessment calls.
export default function StudyPreview({content}) {
  const auth=useMemo(()=>({user:{id:'study-preview',name:'Preview Student',subjects:['english','accountancy','business_studies','economics'],isPremium:false,creditBalance:40},status:'authenticated',isAuthenticated:true,needsOnboarding:false,signOut:async()=>{},refreshSession:async()=>{}}),[]);
  const fixture=useMemo(()=>{
    const store={runs:new Map(),events:new Map(),prefs:{...DEFAULT_PREFERENCES,premium:false,state:'ready'},introduced:new Set()};
    const view=row=>({...row.projection,title:row.title,total:row.items.length,item:publicStudyItem(row.items[row.projection.cursor],row.projection.revealed),units:row.units.map(u=>({id:u.id,title:u.title}))});
    const transport=async(method,path,input)=>{
      if(!window.location.pathname.startsWith('/preview/study')) throw new Error('PREVIEW_ONLY');
      if(method==='GET' && path==='/api/study/catalog')return {state:'ready',subjects:content.syllabus,units:content.units.map(u=>({...u,blocks:undefined,read:false,cardCount:content.cards.filter(c=>c.unitId===u.id).length})),queue:{availableCount:5,dueCount:0,overdueCount:0,newAllowance:5},progress:{lessonsRead:0,recallReviews:0},recallEnabled:true,preferences:store.prefs};
      if(method==='GET' && path.startsWith('/api/study/units/'))return {...content.units.find(u=>u.id===path.split('/').at(-1)),blocks:content.units.find(u=>u.id===path.split('/').at(-1)).blocks.map(b=>publicStudyItem(b))};
      if(method==='PUT' && path==='/api/study/preferences'){store.prefs={...preferences(input,store.prefs,false),premium:false};return store.prefs;}
      if(method==='POST' && path==='/api/study/runs'){
        const units=content.units.filter(u=>!input.unitId || u.id===input.unitId);
        const items=input.mode==='learn'?units[0].blocks.map(b=>({...b,total:units[0].blocks.length})):content.cards.filter(c=>units.some(u=>u.id===c.unitId)).slice(0,5);
        const id=crypto.randomUUID(),projection=createStudyRun({id,mode:input.mode,unitIds:units.map(u=>u.id),cardIds:input.mode==='recall'?items.map(c=>c.id):[]});
        const row={projection,items,units,title:input.mode==='learn'?units[0].title:'A little recall'};store.runs.set(id,row);return view(row);
      }
      const id=path.split('/')[4],row=store.runs.get(id);
      if(!row)throw new Error('RUN_NOT_FOUND');
      if(method==='GET')return view(row);
      const previous=store.events.get(input.requestKey);if(previous)return previous;
      const result=studyTransition(row.projection,row.items[row.projection.cursor],input);row.projection=result.projection;
      if(result.rating)row.projection.lastReview={rating:result.rating,due:new Date(Date.now()+86400000).toISOString()};
      const response=view(row);store.events.set(input.requestKey,response);return response;
    };
    return {transport};
  },[content]);
  return <AuthContext.Provider value={auth}><RoleProvider><div className="arena-fixture-note" role="note"><b>Development study preview</b><span>Illustrative only. Content candidates · no real saves, scores, credits or model calls.</span></div><AppLayoutClient previewRoute="/learn" previewLinks={{learn:'/preview/study'}}><StudyWorkspace preview={fixture}/></AppLayoutClient></RoleProvider></AuthContext.Provider>;
}
