import { handleClass } from '@/lib/classLeague/http';
import { classDeps } from '@/lib/classLeague/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Class leagues (src/lib/classLeague). GET: your class and its latest closed Sunday, or { class: null }. POST { name, subjects }:
// start a class (201). Both answer 404 CLASS_OFF unless CLASS_LEAGUES_ENABLED=true.
export const GET = (request) => handleClass(classDeps(), 'get', request);
export const POST = (request) => handleClass(classDeps(), 'create', request);
