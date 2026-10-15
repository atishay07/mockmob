# Research Protocol — Transcript, Visual Capture, Source QA

## Capture goals

Create **one independently reviewable paper per video**, especially all UX Peak uploads. Do not combine multiple uploads into one generic channel opinion. Link supplementary cross-video synthesis to original per-video evidence IDs.

## Repeatable ingestion stages

1. Export the entire `@uxpeak/videos` and `@TimGabe/videos` public inventories, including ID, exact title, date, duration and URL. Record retrieval timestamp and pagination completeness. Mark deleted/private/region-blocked material separately. Reconcile against the five direct links; never substitute videos by topic.
2. Obtain YouTube-sourced captions (language, manual/ASR, provenance, timestamps). Store the original source outside this research package when the publisher/rights permit, while research package maintains short quotations and extensive analytical paraphrase. Identify uncertain words and automatic-caption failures.
3. Segment into 30–120-second units; code creator claim, example, UI before/after, rationale, numeric assertion, sponsor/promotion, and uncertainty separately.
4. Review accessible video itself and capture stable true frames at decisive changes. For animation/motion, sample start, midpoint, end, interaction trigger and reduced-motion alternative if shown.
5. For each claim identify whether it is (a) narrated hypothetical, (b) creator's anecdotal experience, (c) shown real app UI, or (d) reproducible study. Never upgrade category without evidence.
6. Cross-check statistics or named studies against original accessible sources. Mark uncorroborated numbers 'creator claim — unverified'.
7. Write video paper with four mandatory layers: T (transcript), V (verified footage), S (external source), I (independent analysis); include competing interpretations and limitation.
8. Validate operational recommendations with UX research, WCAG, actual business logic, instrumentation and on-device testing.

## Screenshot standard

For each figure supply:
- `video_id`, canonical URL, media-access method and media-file checksum.
- Timestamp (seconds), original frame dimensions, resize/crop specifications.
- Caption distinguishing **what was visibly in the video** from **what the creator said** and **what the analyst infers**.
- Before/after pairing if relevant; do not infer unobserved interactions from two stills.
- If screenshot contains non-source graphics, annotate and separate into 'analyst illustration', not original footage.
- Permission and copyright compliance; use limited frames for analytical illustration with attribution and avoid distributing large video excerpts.

## Video review template

```
source_id: R04
video_id: 2TlIg3VokY8
creator: uxpeak
coverage: full_verified_caption | sampled_video | full_video_reviewed
T: timecoded spoken paraphrase + minimal exact quotes
V: verified screenshot pairs and described visible states
S: creator's own claims, product links, scientific/UX sources
I: rationale, competing hypotheses, adoption decision, test plan
claim_status: observed | creator_asserted | external_supported | unverified
recommended_action: adopt | adapt | experiment | reject | insufficient_evidence
``` 

## Important limitations in this edition

Direct retrieval of YouTube playback/channel inventories was throttled. Only one of the original five video links had a verified timestamped transcript in indexed third-party sources. Three more UX Peak video assets were discovered; two have transcript access and one has description access. There are NO source video screenshots in this edition. This is a clearly labeled interim research package, not a claim that the whole channel was viewed.

## How to unblock the full requested research

Provide original MP4 files or footage exports for every desired video (or a legal, usable channel/video archive), with SRT/VTT caption exports or speech audio when possible. For comprehensive `@uxpeak/videos` coverage, an exported video URL inventory helps ensure none are missed. An MP4 with its caption track is best because we can distinguish all three critical layers: the creator's words, the actual screen state and external concept analysis.
