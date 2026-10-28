import { readFileSync,writeFileSync,copyFileSync,mkdirSync,readdirSync,statSync } from 'node:fs';
import { resolve,dirname,relative } from 'node:path';
import { createHash } from 'node:crypto';
const root=process.cwd(),target=resolve(root,'artifacts/study-suite/release');
if(!target.startsWith(root+'\\') || !statSync(resolve(target,'.git')).isFile())throw new Error('EXPECTED_ISOLATED_WORKTREE');
const files=[
  '.gitignore','package.json','package-lock.json','data/study_engine.js','data/study_content.js','data/study_scheduler.mjs',
  'data/tests/study_engine.test.mjs','data/tests/study_database.test.mjs',
  'src/app/(app)/layout.js','src/app/(app)/AppLayoutClient.jsx','src/app/(app)/dashboard/DashboardPageClient.jsx',
  'src/app/api/recovery/replay/route.js','src/components/LearningNextAction.jsx','src/components/RecoveryOverview.jsx','src/components/ScoreRecoveryLab.jsx','src/components/ui/Glyph.jsx','src/components/ai/AssistantLauncherGate.jsx',
  'src/lib/arenaNavigation.js','src/lib/server/learning.js','src/lib/server/recoverySessions.js','src/lib/server/study.js','src/lib/server/studyExposure.js','src/services/ai/getStudentAIContext.js',
  'scripts/learning/build-study-pilot.mjs','scripts/learning/validate-study-pilot.mjs','scripts/learning/build-study-import.mjs','scripts/learning/study-schema-dry-run.mjs','scripts/learning/study-current-project-smoke.mjs','scripts/learning/study-ratio-source-check.mjs'
];
const scan=dir=>{for(const entry of readdirSync(resolve(root,dir),{withFileTypes:true})){
  const path=dir+'/'+entry.name;if(path.endsWith('/dict') || /\.(pdf|gz)$/.test(path))continue;
  if(entry.isDirectory())scan(path);else files.push(path);
}};
for(const directory of ['data/study','src/app/(app)/learn','src/app/(app)/study','src/app/api/study','src/app/preview/study','src/components/study'])scan(directory);
for(const entry of readdirSync(resolve(root,'supabase/migrations')))if(/connected_study_suite|study_review_backlog/.test(entry))files.push('supabase/migrations/'+entry);
for(const path of files){const destination=resolve(target,path);mkdirSync(dirname(destination),{recursive:true});copyFileSync(resolve(root,path),destination);}
// Local build only. This file is ignored by both checkouts and never added to the release manifest.
copyFileSync(resolve(root,'.env.local'),resolve(target,'.env.local'));
const manifest={at:new Date().toISOString(),base:'6c5e05b6562830fc2e12450a87846eb8c678f0c2',target:relative(root,target),files:files.map(path=>({path,sha256:createHash('sha256').update(readFileSync(resolve(target,path))).digest('hex')})),preservedOwnerEdits:['AI capabilities and provider routing','AI evaluation scripts','pricing pages','payment scripts','landing ProductScreens','previous local status entries'],secretsInManifest:false};
writeFileSync(resolve(root,'artifacts/study-suite/release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({files:files.length,isolatedCheckout:manifest.target,ownerEditsExcluded:true}));
