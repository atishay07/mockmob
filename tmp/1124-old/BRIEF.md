# Third check of the OLD bank (24 Nov 2026)

MockMob shows, for the real CUET UG 2026 papers, how many questions its material teaches. One figure is "what the old bank
taught": the bank and Key cards as they stood when the papers were first read. Two first checkers (A and B) each searched
that old material; a question counted only when both found it. This third check asks one thing about the questions that did
NOT count then: **did the old material in fact already teach it, and the first checkers missed or disagreed?**

The answer must be true. A found match is published with its id so any student can check it. A doubtful match is NOT a
match. Finding nothing is a normal, acceptable result; most of these questions were probably missed for a good reason.

FOLDER = `C:\Users\atish\Desktop\mockmob copy\wt-1110-convert\tmp\1124-old`

## Files of a subject (`FOLDER\<subject>\`)
- `todo.json`: the questions to check: `n`, `chapter`, `type` (theory or numerical), `stem`, `passage`, `options`,
  `answerPosition` (1-based position of NTA's key in `options`), and `firstCheck.A` / `firstCheck.B` (each first checker's
  verdict, the ids it cited and its reason; read them: a "not covered" reason often says exactly which fact was missing).
- `old-bank.json`: every bank question that was served at the first check: `id`, `chapter`, `body`, `options`,
  `correct_answer`, `explanation`.
- `old-cards.json`: every Key card published at the first check: `id`, `chapter`, `kind`, `front`, `back`.
These two files are the ONLY material that counts. Do not use the live database, `data/keycards/decks`, the coverage
`-final.json` files, any `tmp\1123-close` or `tmp\1122-coverage` file, or the web. Do not open another agent's output.

## The rule (strict; the same rule the first checkers used)
1. Before searching, write the facts or steps needed to reach NTA's key (for a match, sequence or multi-statement item:
   every part that the key depends on, including what makes each wrong option wrong where the key cannot be reached
   without it).
2. Search both files widely: by keyword and synonym across ALL chapters (grep or a small node/python script in your own
   temp folder), then READ the candidate's full text. The first checkers searched mostly within the chapter; look wider.
3. **Theory = covered only if EVERY needed fact is stated** by old material: a bank question's key or explanation, or a
   Key card's back (or its front and back together). Several rows or cards may together state the facts.
4. **Numerical = covered only if an old BANK question uses the same formula and the same steps** (same unknown, same
   direction). Different numbers are fine. A Key card formula alone never covers a numerical. A bank row with a wrong key
   or wrong working never counts.
5. A fact that is only implied, only in a wrong option, or only derivable by elimination is NOT stated.
6. When in doubt: not covered.

## Output
Write `FOLDER\<subject>\found-<PART>.json` (PART is given in your prompt; "all" if not): a JSON array with one object for
EVERY question you were given, in order:
```
{ "n": 12, "verdict": "covered" | "not_covered", "matchKind": "same" | "new-values" | "concept" | null,
  "facts": [ { "fact": "<one needed fact or step>", "ids": ["<bank id or card id that states it>"], "quote": "<the exact words of that row or card that state it, at most 200 characters>" } ],
  "best": "<the one id that teaches most of it, or null>", "bestKind": "bank" | "card" | null,
  "reason": "<one plain sentence a student could read: what the old material says, or what is missing>" }
```
`matchKind`: "same" = the old row asks the same thing; "new-values" = a numerical with the same steps and other numbers;
"concept" = the facts are stated though the question is asked differently. For "not_covered", `facts` lists the needed
facts with empty `ids` for the missing ones, `best` null.
Every id must be copied from `old-bank.json` or `old-cards.json`, and every `quote` must be the real words of that id.
Write only your output file. No servers, no browsers, no database, no git.
