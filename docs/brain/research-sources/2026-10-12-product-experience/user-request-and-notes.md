# Owner request and supplied notes

Provenance: current owner message, 12 October 2026. Copied from the conversation for research retention. These are the supplied request and summaries; the attachments remain separate sources. Typography/line wrapping reflects this Markdown transcription of the message.

This is research on a transcript of a few videos and some ideations, ideas, and some top practices that I want incorporated into MockMob (on the website and in the app, which we are going to soon release).

These are the kinds of things I want my models to always take care of whenever they are performing: the UI/UX, the experience, and how the entire app and the experience are being built around something. That is really, really important, but AI models usually lag on that. I want to create a flow in which they are always on top of all these things.

Along with that, I'm attaching another transcript for you from some videos that I was watching right now. It has some very useful insights. Each 10 seconds has some other very highly useful insight. If it is taken care of and implemented, it can be like the next report.

Right now, what we need to focus upon is integrating everything into a single research document. I want you to take both of these: the transcripts I'm uploading to you and the text that I'm giving you, and form all the findings into a proper research document. We can first upload it on the brain, and then set some guidelines and rules that have to be followed in the new document that you make:

- Only add things.
- Don't try to summarize a lot of things or miss things which you think are not important but actually are.
- You can add things.
- You can explain more about things which are in brief right now.
- You can go deeper into an idea.

That's your job right now.

Recording of two design videos: a UI/UX fundamentals walkthrough for dashboards and interfaces, and an Undertone app case study on improving retention by redesigning its post-session recap moment.

### Data-Driven Dashboard Design

- Build UI around the data: chips for fixed categories, right-aligned numbers, truncated text, shaded inactive rows
- Time-based data works better as a timeline than a time-sorted table, e.g. in a sidebar pop-out
- Color should come from the data (red for urgent actions), not decoration
- Progressive disclosure: tuck rarely used actions like share into popovers, show secondary actions on hover

### Visual Hierarchy, Layout and Typography

- Hierarchy comes from size, position, and color contrast; most important items large, bold, near the top
- Grids are guidelines; white space and a 4-point grid (e.g. 32 pixels between items) matter more
- Use one sans-serif font; tighten large headers by -2 to -3% letter spacing and 110 to 120% line height
-

* Max 6 font sizes for landing pages; dashboards rarely exceed 24 pixels

1. Start with one primary brand color, build a ramp, use semantic colors (blue trust, red danger, yellow warning, green success)

### Dark Mode, Components and Feedback

- Dark mode: softer borders, lighter cards than background for depth, desaturated chips
- Light-mode shadows: lower opacity, more blur; popovers need stronger shadows than cards
- Size icons to the font line height (e.g. 24 pixels); button width padding about double the height
- Every interaction needs a response: 4 button states, input focus/error states, micro-interactions, gradient overlays on images

### Undertone Case Study: Diagnosing Retention

- Onboarding completion beat average, but half who finished never recorded a therapy session
- High completion reflected urgent, high-intent users with few alternatives, not good onboarding
- Mic tests averaged about 20 seconds and hit a 10-minute minimum wall; founder estimated maybe 10% lost there
- PostHog data: users open the session summary a median of about 10 minutes after recording ends (fastest 6, slowest 44)

### Undertone Redesign and the Recap Moment

- Brand refresh and design system first, aiming for intentional minimalism between clinical and minimal
- Mic test moved into onboarding with an interactive demo showing a real recap
- Dynamic Island shows processing stages (transcribing, anonymizing, summarizing) and prevents forgotten 4 to 6 hour recordings
- Recap redesigned as an unboxing based on the peak end rule: wrapped reveal, confetti, haptics, then prompt to book next session

Tim's video series on product design: emotional design (Duolingo, Phantom, Revolut), betting against a category's hidden assumption, and which gamification and retention mechanics actually work.

### Emotional Design as a Competitive Edge

- Building is easy now; the lasting edge is how a product makes people feel, not code or features
- Duolingo's 2022 character animation system coincided with DAUs rising from 14.2 million to over 34 million in 2 years
-

* Advice: micro-interactions, celebrate small wins, expressive mascots, progress animations like streaks

1. Crypto wallet (transcribed 'Fantom', likely Phantom) used playful animation to make crypto feel less scary; became #2 US utilities app
2.

- Lesson: polish builds trust; treat motion and transitions as core features in high-stakes spaces

1. Revolut's polished onboarding, tactile glowing charts and 3D cards support its premium push; nail the first impression

### Betting Against the Hidden Assumption

- Leaders build on an unspoken user belief; doing the opposite is hard for them to copy without hurting revenue
- TimeLeft: no bios, no swiping, no planning; about 120,000 people a month by August 2025
-

* Bumble responded with a separate group app (transcribed 'Plants')

1. Speak chose speaking-first efficacy over games, passing $100 million annualized revenue in November 2025
2. Health app (transcribed 'Devil') runs on existing watches instead of a $500 ring; grew 8x in a year, Series A from General Catalyst

### Gamification Patterns That Work

- Points, badges and leaderboards often fail: LinkedIn, Foursquare and Google News dropped badges
- Strava's hyper-local, winnable segments and kudos drive engagement; clubs grew 59% in 2024
- Feature richness follows an S-curve; Habitica's heavy game layer backfired for all study participants
- Streaks drift from motivation to obligation and face regulation; Duolingo wraps them in agency (goals, freezes)
-

* Alternatives: variable reward magnitude, Apple ring completion drive (49.5% behavior change), competence feedback like P

### Psychology Behind Addictive Apps

- Variable ratio rewards create craving, not pleasure; Finch uses unpredictable bird discoveries
- Loss aversion: 6 up's diamond streak system for FreeCash makes milestones feel earned and costly to lose
- No terminal states (League of Legends seasonal resets) and social comparison keep users hooked
-

* Strava deleted 3.9 million activities from users gaming leaderboards

I have also attached a short summary of the video so that you have the topics to deep dive into.
