# Premium UI/UX Research Brain — Evidence-First Edition

**Build date:** 2026-10-16  
**Stage:** PARTIAL — verified transcript papers plus explicitly pending sources. **Not a finished full-channel review.**  
**Scope requested:** @TimGabe, @uxpeak/videos (every available video eventually), and five direct links.  
**Method:** T = transcript-derived; V = direct video frame; S = external/creator supporting source; I = independent interpretation. Distinct source categories are never merged.

## Start here

1. `source-ledger/SOURCE_MANIFEST.csv`: Every requested URL (including the direct links not yet retrievable), plus extra discovered UX Peak videos.
2. `papers/uxpeak-2TlIg3VokY8.md`: a detailed source- and timestamp-grounded research paper on *The UX Psychology Behind Apps People Can't Stop Using* (T).
3. `papers/uxpeak-zr37ibqXl1U.md`: detailed independent research paper on three UX redesign comparisons (T); discovered during the channel audit, **not one of the five direct links**.
4. `papers/uxpeak-03Xw8UyC6uo.md`: foundations paper (T); discovered during the channel audit.
5. `papers/uxpeak-GGg61sdEjeI.md`: shorter paper using YouTube video description metadata (S), **not the transcript**.
6. `papers/ai-slop-independent.md`: independent synthesis relevant to the user-highlighted video XKDfs9xTzfw, whose content is **not yet accessed** (S/I only).
7. `AGENT_RULES.md`: design + implementation instructions, explicitly distinguishing research findings from our recommendations.
8. `methodology/CAPTURE_AND_QA.md`: ingestion, video-frame capture and transcript QA; visual evidence pending.
9. `source-ledger/EVIDENCE_INDEX.csv`: time-stamped claims and source states.

## What was actually verified

- UX Peak **2TlIg3VokY8**: English caption-derived timestamped transcript via https://youtube2text.diguardia.org/v/the-ux-psychology-behind-apps-people-can-t-stop-using-2TlIg3VokY8. Counts reported by this transcription site: 2,115 words and 333 segments. Descriptions also available from YouTube search indexing.
- UX Peak **zr37ibqXl1U**: timestamped caption-derived transcript via https://youtube2text.diguardia.org/v/top-3-ux-ui-redesigns-that-make-you-design-like-a-pro-zr37ibqXl1U. Site reports 2,480 words and 383 segments.
- UX Peak **03Xw8UyC6uo**: timestamped caption-derived transcript via https://youtube2text.diguardia.org/v/the-shortest-ux-ui-design-course-03Xw8UyC6uo. Site reports 1,166 words and 183 segments.
- UX Peak **GGg61sdEjeI**: published description on a third-party video mirror, not full transcript.
- UX Peak's own website provides independent public before/after descriptions; Tim Gabe's own website identifies his Framer, Figma and creative work. These are supporting sources (S), not evidence of what either said in an inaccessible video.

## Not verified; do not present as completed video research

The direct videos **8EAYZe6y3I8**, **qJ4qYhTqAz0**, **soZgjJi7xNw** and **XKDfs9xTzfw** could not be resolved to reliable transcripts in this research session. They remain registered in the manifest. None has been silently dropped or substituted with a similarly themed video. The full inventories of @uxpeak and @TimGabe could not be reliably enumerated because their YouTube channel pages returned minimal content; claiming every upload has been studied would be false. No actual video frames were captured, and no supplied source screenshots are included as if they were frames. See capture plan.

## Evidence principles

- **T:** Quote no more than short excerpts and provide timestamp + transcript URL. Primary video remains the canonical linked source; a third-party caption export is a transcript surrogate, and ASR/caption errors are possible.
- **V:** Only true frame extraction from accessible video at an exact timestamp. A video thumbnail, illustration, recreation or website screenshot is not a verified frame.
- **S:** Clearly label creator web pages, design articles, official docs, video descriptions and supporting research. Never turn a creator's marketing description into a proven causal finding.
- **I:** Our own normative recommendations are hypotheses or practical standards, not video quotations, replicated experimental results, or observed real-world performance.
- Creator-showcased A/B designs do **not** automatically indicate a real published, randomized A/B experiment. Without methodology or measurements, treat creator performance comparisons as creator-asserted demonstrations.
- Psychological numerical claims (for example 70–90% default adherence, '2x' loss aversion, large conversion lifts) must not be encoded as universal facts unless independently verified.

## Accessibility for coding agents

Check this README; read `AGENT_RULES.md`; retrieve the paper that corresponds to the screen/flow being built; link any design rationale to evidence IDs in `EVIDENCE_INDEX.csv`. Do not load all papers into the model's context unnecessarily. For shared use across Claude, Codex and other agents, commit this directory to the repo or expose it via an authorized file-retrieval system and point each agent's instructions to it. The files do not become cross-model memory automatically.

## Important copyright note

The package contains detailed, original, timecoded analyses and only very short quotations rather than reproducing entire third-party video transcripts. The transcript links let a reviewer consult the full original caption-derived sources where available.
