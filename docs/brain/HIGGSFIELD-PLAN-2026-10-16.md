# Higgsfield (AI video) plan, 16 Oct 2026

The owner's question (16 Oct, about 10:40 pm): is Higgsfield video useful for MockMob's website and app, where are we lacking motion, and how should a USD 15 API budget be spent, with a plan future agents can follow. Prices are the owner's screenshot of the Higgsfield API page on 16 Oct. They are "from" prices for each model's cheapest mode, so 1080p costs more. Confirm the mode price in the API before every run.

## 1. Verdict: useful, but only for a narrow set of jobs

**Video is NOT for UI motion.** Screen transitions, sheets, count-ups, the result reveal, the clock turn, press feedback and Mobi all stay code-native (Flutter animations, CSS and the Web Animations API, SVG), for five reasons:
- **Themes:** code motion follows Night and Day. A video does not.
- **Crispness:** code motion is sharp at every size. Video blurs and bands on text and edges.
- **Interaction:** code motion is interruptible and follows the finger. Video only plays.
- **Reduced motion:** code motion honours it per element.
- **Cost:** code motion weighs almost nothing. Video adds MB to the APK and to bandwidth.

The owner's research brain agrees: motion must answer an action or show state (AGENT_RULES; the app pass removes loops on resting screens, M05). It also says to use real product screens, never fake dashboards or fake results (T007, T009). So an AI video of our own UI is not allowed.

**Mobi stays a code rig** (rig v2, 31 acts, one character on both surfaces). An AI video of Mobi would be a second, off-model Mobi. Do not do it.

**SVG versus video:** SVG and code cover flat shapes, icons, lines, numbers and the mascot. They cannot convincingly do lamp light, paper, texture, depth or camera moves on our lamp-lit subject objects. That is exactly where video earns its place.

## 2. Where video adds something we cannot get otherwise

| # | Use | Where it shows | Why it is not slop | Size limit |
|---|---|---|---|---|
| U1 | **Subject objects come alive, once**: a 1.5-3 s one-shot when a student picks a subject. The ledger book opens, the briefcase unlatches, the economics chart rises. Never a loop. | App Practice subject pick and subject hub hero; website Practice subject pick and the landing subject shelf on select | It answers an action (the pick). It ends on the existing still, so the still stays the canonical art. Reduced motion shows only the still. | 512x512, H.264 MP4 and VP9 WebM, about 150-250 KB each. App: stream from the CDN with the still as the poster; never bundle all 15. |
| U2 | **Play Store and launch promo**: 2-4 cinematic shots (lamp-lit desk, the subject objects, night-to-morning) that open and close a 30 s promo. **The middle of the promo is real screen recordings of the app.** | Play listing promo video (YouTube), the landing "see it" link later | The real product is shown as real recordings. AI covers only mood shots of our own art world. | 1080p source; YouTube hosts it |
| U3 | **One milestone moment**: a short object-based celebration for a true event (first timed mock, a badge), shown once | App result after the event, website Progress | It is tied to a real event and plays once. | Same as U1 |

**Not planned:** hero background video, ambient loops, fake product demos, AI Mobi, talking heads, any marketing campaign video. Marketing waits until January, per the owner.

## 3. Which model for which job (16 Oct prices)

| Model | Price (from) | Use it for |
|---|---|---|
| **Wan 3.0** | USD 0.020/s (60% off until 31 Oct, then 50% off) | **Exploration**: finding prompts and motion on low-res 3-4 s drafts. The cheapest way to learn what works. |
| **Wan 3.0 Prime** | USD 0.027/s (60% off until 31 Oct) | Better drafts when Wan 3.0 is close but not clean |
| **Kling 3.0** | USD 0.042/s (60% off, max-discount) | **Production for U1 and U3**: short image-to-video one-shots from our own still, which must end on that still. Good adherence at a low price. |
| **Seedance 2.5** | USD 0.144/s (30% off) | **Only the 2-4 hero shots of U2**, where prompt accuracy and cinematic quality matter most. Never for drafts. |
| Seedance 2.0, Kling 2.5/2.6/O1, Genjutsu | 0.036-0.270/s | Not planned. Kling 3.0 and Seedance 2.5 cover the need. |
| Marketing Studio Image | USD 0.011/image | Only if the GPT image account cannot make a needed still |

**Stills (keyframes, Play graphics, object variants):** use the owner's GPT account (GPT Image) first. Its cost is already paid, and image-to-video from our own approved stills keeps every clip on-brand.

## 4. The USD 15 budget

| Step | Model | Plan | Cost |
|---|---|---|---|
| 0 | none | Pick keyframes from our approved object art. Write one prompt sheet per use. The owner approves the 3 test subjects. | 0 |
| 1 | Wan 3.0 | 3 subjects x 4 prompt variants x 4 s at low res (about 48 s) | about 1.0 |
| 2 | Kling 3.0 | U1 for the 3 test subjects, 3 s each at 1080p, 2 tries each (about 18 s, 1080p priced at about 2x) | about 1.5 |
| 3 | Owner review | He watches the 3 clips in the app and on the website. **Stop here unless he approves.** | 0 |
| 4 | Kling 3.0 | U1 for the other 12 offered subjects, 3 s each with 1 retry (about 72 s at 1080p) | about 6.0 |
| 5 | Seedance 2.5 | U2: 3 hero shots of 5 s, 1 try each (15 s; more at 1080p) | about 3.0-4.5 |
| 6 | reserve | Retries, U3 | about 2.0 |
| | | **Total** | **about 14.5, cap 15.0** |

Step 1 runs before 31 Oct, while Wan's 60% discount lasts.

## 5. Rules every agent follows

1. **Ledger first.** Log every generation in `mockmob-next/tmp/higgsfield/LEDGER.csv`: time, model, mode, seconds, resolution, estimated and actual cost, purpose, result file, kept or rejected. Before each call, sum the actuals. If the call would pass USD 15, do not make it.
2. **The key never appears in chat or a commit.** The owner puts `HIGGSFIELD_API_KEY` in a git-ignored local env file. Agents read it from the environment only.
3. **Image-to-video from our own approved stills.** No text-to-video of the product, no AI Mobi, no AI UI.
4. **Owner approval at step 3** before any batch run. Show the clips in place, in the app and on the site, not as files.
5. **Ship rules:**
   - one-shot only, never a loop on a resting screen;
   - the poster still renders first;
   - reduced motion shows the still only;
   - stay under the size limits in section 2;
   - Night and Day both checked;
   - the clip ends on the canonical still, so there is no jump.
6. **Done means seen in use:** captured at 390 and 1440 on the website and on the emulator for the app, with screenshots and a recording looked at. A file in a folder is not done.

## 6. Status

The account is not connected yet. Next step when the owner says go: he adds the key to a local env file, and an agent runs steps 0-2. That is about USD 2.5 at most, with the 3 test clips shown to him in place.
