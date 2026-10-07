import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/roles';
import { factoryOverview,controlFactory,exportLegacyBundles,applySubscriptionReview } from '@/lib/server/questionFactory';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request) {
  const guard=await requireAdmin();if(!guard.ok)return NextResponse.json({error:guard.reason},{status:guard.status});
  try {
    const value=new URL(request.url).searchParams.get('export')==='legacy'?await exportLegacyBundles():await factoryOverview();
    return NextResponse.json(value,{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return NextResponse.json({error:e.message},{status:503});}
}
export async function POST(request) {
  const guard=await requireAdmin();if(!guard.ok)return NextResponse.json({error:guard.reason},{status:guard.status});
  const origin=request.headers.get('origin');
  if(!origin || new URL(request.url).origin!==origin)return NextResponse.json({error:'same_origin_required'},{status:403});
  if(Number(request.headers.get('content-length') || 0)>1000000)return NextResponse.json({error:'review_payload_too_large'},{status:413});
  try {
    const text=await request.text();if(Buffer.byteLength(text)>1000000)return NextResponse.json({error:'review_payload_too_large'},{status:413});
    const input=JSON.parse(text);
    const value=input.action==='import_review'?await applySubscriptionReview(input.payload):await controlFactory(input.action);
    return NextResponse.json(value);
  } catch(e) {return NextResponse.json({error:e.message},{status:409});}
}
