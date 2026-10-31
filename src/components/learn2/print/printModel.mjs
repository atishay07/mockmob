// What the chapter sheet prints: the open Must-know cards, in the deck's order. (Free never gets here: the row is Pro's.)
export const printCards = (open = []) => (Array.isArray(open) ? open : []).filter((c) => c && c.importance === 'must' && !c.locked);

/** Whether the shelf's print row prints (Pro with Must-know lines) or is Pro's teaser: the row view says it with `action`. */
export const rowPrints = (row) => row?.id === 'print' && row.action === 'print';
