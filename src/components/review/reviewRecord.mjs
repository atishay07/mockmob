// The record reviewMove() reads, rebuilt on the client from GET /api/me/review's body (LEARN-REVIEW-1017 P-LR1). PURE, so
// node --test checks that the page's move equals the move of the record the server read (data/tests/review_page.test.mjs).
/**
 * The record reviewMove() reads, rebuilt from the body GET /api/me/review returns (the body carries every field the
 * record had: papers, chapters, items in server order, wallet, revise, repairOrder). PURE.
 */
export function recordFromBody(body) {
  if (!body || body.state === 'unavailable') return null;
  return {
    state: body.state, now: body.now, wallet: body.wallet ?? null,
    papers: body.papers || [],
    chapters: (body.chapters || []).map((c) => ({ id: c.id, name: c.name, subject: c.subject, subjectName: c.subjectName })),
    items: (body.items || []).map((i) => ({
      paper: i.paper, q: i.q, qid: i.qid ?? undefined, ch: i.ch, state: i.state, stem: i.stem,
      ...(i.pick ? { pick: i.pick } : {}), ...(i.keyState ? { keyState: i.keyState } : {}),
      ...(i.repairedAt ? { repairedAt: i.repairedAt } : {}), ...(i.checkedAt ? { checkedAt: i.checkedAt } : {}), ...(i.reviseNext ? { reviseNext: i.reviseNext } : {}),
    })),
    revise: body.revise ?? null,
    ...(Array.isArray(body.repairOrder) && body.repairOrder.length ? { repairOrder: body.repairOrder } : {}),
  };
}

