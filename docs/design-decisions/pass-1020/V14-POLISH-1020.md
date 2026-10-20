# Version 14 polish: Day mode, the plan strip, the Pro table, the Wallet (20 Oct 2026)

Owner feedback after installing version 13 from the Play Store: `docs/brain/OWNER-FEEDBACK-2026-10-19.md`, ledger K1, K3, K4, K6 and D165. Branch `ui/1020-v14-polish` from `ui/v17-release` fe076156.

## K1 Day mode
- **Task.** Day should feel as designed as Night. His example: the "Ways to practise" cards, with black text and black icons.
- **What the audit found** (demo walk at 360 dp, Night and Day, `mockmob-next/tmp/walk-1020/v14-polish/before`):
  - Practice's drawn objects (`ChoiceGlyph`: bolt, book, target, stopwatch, speech bubble, answer sheet, arrows) took the page's ink as their body. Night gets paper-white porcelain; Day got near-black objects. This was the main defect, and it shows on Practice, the quick-start sheet and Today.
  - Tiles on a Day sheet used Day `raised2`, which is darker than the ground and reads as a grey hole (quick-start Full mock and NTA tiles).
  - The Mob's weekly quest bar filled in near-black blocks on Day.
- **Decision.** On Day, the objects are the same porcelain objects as on Night. A Day keyline (warm ink at 30%) and a deeper drop hold their edge on cream. One object set serves both themes; the NTA palette was already identical. A Day tile on a sheet is the same lifted card as on the page: raised, a hairline and the card shadow. The Day quest bar fills in the parcel's kraft. Night is unchanged.
- **Alternatives tried** (prototype goldens): warm putty (washed out), graphite `ink3` (still reads dark), and porcelain without a keyline (the bolt and the bubble vanish on cream).

## K3 and K6: the plan strip near the top of You
- One quiet card under the name, in two halves:
  - Credits: the balance, which opens the Wallet.
  - Plan: "Free plan" and "Upgrade to Pro", which opens the Pro page. The half carries the Pro column's volt wash from the Pro page's table, so it is not a banner. A Pro student sees their plan and its date.
- With Google Play off, there is no upgrade key that leads nowhere.
- The old plan row at the very bottom of You is gone. The strip replaces it, so nothing shows twice.
- Practice gets a credit line under the ways to practise, for Free students only. It shows the balance, a way to the Wallet and the one free full mock per subject.

## K4: the Pro page table
- The Free cell of Full mocks was cut off: three lines in a fixed 48 dp row. Rows now grow with their words, and row names wrap instead of ending in an ellipsis.
- While the server's rule is on, the row reads "Full mocks", "Your first in each subject is free", "Then 50 credits".
- Wherever a full mock is priced in credits, the price says "Only your first full mock in each subject is free" while the rule is on.

## K6: the Wallet
- The Wallet has its own object: a code-drawn stack of brass credit coins with a volt enamel face, beside the balance. It uses the same brass and volt as the badge tokens.
- Each pack shows a stack sized to the pack. The "Enough for N doubts or fixes with Mobi" lines are kept.
- "What credits buy" is one price list instead of four identical tiles. The costs sit in a right-aligned column, and Mobi's jobs come first.
- Under the list, while the rule is on, one line explains why the first full mock is free: "Your first full mock in each subject is free, so you can sit a real exam-style paper and see your full reveal before you pay."

## D165 (copy ready, off)
- The words for the 50 welcome credits and the 100-each invite are in `WalletCopy`.
- `referralOfferLiveProvider` is false. No server field exists yet (web/1020-referrals has none). Until one does, nothing about invites is drawn.

## Verification
- Goldens are listed in the commit.
- New tests are in `test/unit/release/v14_polish_test.dart`.
- New goldens: `pro_compare_*_360_text100|130` and `plan_strip_*_360_text100|130`.
- The emulator walk is in `mockmob-next/tmp/walk-1020/v14-polish/after`.
