// Development only: the Key cards routes answered from the real bundled decks for the visual preview (?decks=real), through
// src/lib/server/keycardsPreview.js. The import sits inside the NODE_ENV test, which a production build replaces with a
// constant, so the module and its deck reads are dropped from production; production answers 404 here.
export const dynamic = 'force-dynamic';

async function handle(request) {
  if (process.env.NODE_ENV !== 'production') {
    const { previewKeycards } = await import('@/lib/server/keycardsPreview');
    return previewKeycards(request);
  }
  return new Response('Not found', { status: 404 });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
