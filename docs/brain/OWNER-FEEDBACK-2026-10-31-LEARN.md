# Owner feedback, 31 Oct 2026 about 5:20 pm IST: Learn and Key cards on the live website

He checked Key cards himself on www.mockmob.in after they went live (flag on at 1:35 pm).

## Verbatim
> Some parts are good and some are very confusing.
>
> * The journey to reach the keycard section is itself not very well placed and very small.
> * Just like in accountancy, when I select your part, it glitches sometimes and shuffles it. It's a bit buggy.
> * The interface regarding all of the things that you have built in the Learn section is itself not very good or easy to use.
> * Once we even get into a specific card or chapter (or whatever this is, like Accounting Partnership, Accounting Partnership Basic Concepts), in the Read section it's a very weird layout.
> * The Study section is the only part I like. It's exactly what we wanted but that also should maybe have some animation or something. When I press Got It and when there is that Print That Chapter Sheet, it's maybe a good idea but it should have our watermark all over the place so that no one can copy it. This is not watermark content but still we are Fitzmeen downloading.
> * This last Look, I really didn't understand. What's the difference between this and the Read section? It's a bit confusing.
> * All this should be integrated better, more tastefully, and more in the flow.
> * This overall Learn section needs easier self-control rather than just being based on focusing upon the weaknesses and all. If someone is trying to figure out things there, it's very confusing.
> * The Learn section should be according to this flow I am giving you as an example: someone comes in, they select a subject, they select the concept that they have to practice, and then there are many things lined up there. They select the time for which they want to practice and there are some combinations of cards and questions lined up for them. There is also a separate section that easily shows them what exactly to find where or, if they want to, separately revise something, some specific cards, and something else.
> * All of this, you have to think about how to integrate everything properly and make a good UI/UX. There should not be just lines and lines of text and stuff like that everywhere, an overload of information with no clear next action. Even the next clear action that you have is not dynamic. It's just one thing that it is showing, with no more options.
> * This is not a poor requirement but still this is far from what we are looking to do. These cards and everything are the core area for the Learn thing, the entire Learn area, so it should be better, as I said. Then you can integrate it in the Explore section also, maybe creating a customized feed for practicing a chapter, like starting a 10-minute lesson. It just shows randomly some practice cards, MCQ stuff like that, so everything has to be thoughtful. You have to think it through, which you are not doing right now.
>
> Pick up this direction and start working on this and making better progress. Honestly, I have not seen the quality of the overall cards. They seem decent to me, but everything just has a "must know" mark to it, which makes it kind of weird. Okay, not everything has it, but multiple things have it. These can be changed or something. For many of these things, you have to spend longer time thinking these through. And I'm giving you the basic direction, so ideate better on all of this.

Transcription guesses (confirm): "Fitzmeen downloading" probably means "preventing downloading" or "we are fine with them downloading, but it must carry our mark". "Accounting Partnership Basic Concepts" is the chapter "Accounting for Partnership: Basic Concepts".

## Items (folded into OWNER-MASTER-LEDGER.md, section "Learn and Key cards, 31 Oct evening")
| ID | Item |
|---|---|
| LK1 | The way to Key cards is badly placed and too small. |
| LK2 | Bug: choosing "Your part" (Accountancy) sometimes glitches and reorders the options. |
| LK3 | The Learn section as a whole is not good or easy to use. |
| LK4 | Read mode inside a chapter has a weird layout. |
| LK5 | Study mode is right ("exactly what we wanted"); add motion, for example on Got it. |
| LK6 | Print chapter sheet: keep it, but put the MockMob watermark all over it so it can't be copied. |
| LK7 | Last look vs Read is unclear. |
| LK8 | Integrate everything better, more tastefully, in the flow. |
| LK9 | Learn must give the student easy control of their own study, not only weakness-led steering; it is confusing to find things. |
| LK10 | The flow: pick a subject, pick the concept or chapter, see what is lined up, pick a time, get a mix of cards and questions. Plus a separate place that shows what is where and lets them revise specific cards or anything else they choose. |
| LK11 | No walls of text or information overload; the next action must be clear and dynamic, with options, not one fixed suggestion. |
| LK12 | Cards are the core of the whole Learn area. Also bring them to Explore: a custom feed to practise a chapter (for example a 10-minute run mixing cards and MCQs). Think it through. |
| LK13 | Too many cards carry "Must-know"; change it. |
| LK14 | Spend longer thinking; ideate better. |


## 31 Oct 2026, about 11:20 pm IST: his answers to A9 and N1 (verbatim)

1. The explore feed can be free but up to a certain limit or something. You can think of some freemium kind of thing.
2. The sidebar: I have been thinking about this previously and we were also thinking about this. Right now I was also thinking about how to integrate it. The current structure was good: one practice tab, then below it some study features in Mob. I think the learn section itself has now expanded a lot, so we can make it into another part. It would lead to more buttons and more sections. Maybe it won't be a very big problem on the website, but it will be a huge problem to integrate it properly in the app, as we can't expand the navbar more. Think about how you can do it.
If I check the current learn section, I don't know if you have committed any changes. I don't see any changes exactly and am not sure at all what you have done. I don't see any changes at all, so I am not going to judge anything or comment on anything else right now.

**Folded in:**
- **LK15 (A9):** questions in the feed and in Learn sessions are free up to a limit.
  - CTO rule: Free gets one Learn session a day, either a chapter run or the Explore feed, up to 10 minutes, with its questions free. The card limits stay as they are.
  - Explore's plain question swipe stays unlimited, as it is today.
  - Pro gets any number of sessions, of any length.
  - The limit line shows only when he hits the limit.
- **LK16 (N1):** Learn becomes its own section, without adding a slot to the app's bar. The spec is in learn-1031/NAV-2.md on branch web/1031-learn-v2, rendered as `&nav=n2`.
- **LK17:** he could not see any change. Nothing is deployed. The build runs only in the local preview, so it was opened for him in the app's browser pane.


## 31 Oct 2026, about 11:50 pm IST: his verdict on the nav v2 renders (verbatim)

I feel like the website integration might be fine, but the issue is, if you see the old app, we already have the segregation for Practice, Your Paper, and Learn. Learn is kind of its own tab already, and just having Find and Device, which we have segregated in Learn, even on the website, also doesn't make much sense. What extra are we adding by making Learn a new tab?

I was thinking that if you have to add multiple tabs to it, and only if that's necessary, then you could think about having Learn as an extra tab. Explore already had its own tab and was different, so I don't know. It doesn't make much sense right now, especially if you are planning to split them up. In the app, it's looking very weird. The current implementation looks way cleaner.

Of course, we might not be able to incorporate Find, Learn, and all those kinds of things there. To be honest with you, I currently don't know what the best approach is. Maybe we can remove the Explore and Find kinds of things from the phone, but I also want to keep the Explore feed and make it a very cool feature on the mobile app. I'm not sure right now, and from these mockups, I can't tell much either. If you can build something, or if you have an actual live prototype on that, only then can I comment more.

**Folded in:**
- **LK16 is closed.** Nav v2 (n2) is rejected and reverted. The current navigation stays: Learn is a door in Practice, and on the website Learn is first under Practice. The record is learn-1031/NAV-2.md.
- **LK18:** the Explore feed becomes a standout phone feature. Find moves inside Learn as a search field, and stops being a separate toggle.
- **LK19:** he judges only live prototypes, so he gets a link he can open on his phone, not static mock-ups.
  - Spec: learn-1031/FEED-2.md on branch web/1031-learn-v2.


## 1 Nov 2026, about 1:25 am IST: his look at the live prototype, on the computer (verbatim)

I have opened him right now on the computer only not on the phone but I think they are enough for the feedback.

The first one, the feed: I really like the direction but I don't know if this was made for phone purposes only. On PC there is no way to go on to the next thing. I know you are trying something like a story but it's just stuck on one thing with too much blank space everywhere.

Explore with chapter covers: I really love the things you have built and the direction that you are taking. If you are doing it for accountancy and chapter fields are all showing just the accountancy logos, it doesn't make much sense and can be replaced with something else.

When I went inside and checked in the Learn section, if we go to any specific chapter and then practice it, it is quite good. The customization according to the time adjusts the questions and all. The direction is there but can be refined a lot. That part is missing and overall many things have too much blank space or need a lot of UI refinement. Still I would say.

Right now your task is to build this feature completely and test out everything, including any issues that are there and how everything can be perfected. We have the systems around it. We need to really refine and think about the UI/UX of this entire thing, the entire logic behind it, and making it more useful. All this should be done right now. Then let me know what you need from me or what exactly my next steps are.

**Folded in:**
- **LK20:** the feed on a computer has no way to the next item ("stuck on one thing") and too much blank space. He likes the direction.
- **LK21:** he loves the Explore covers' direction, but every Accountancy cover shows the same Accountancy object. Replace it with something chapter-specific.
- **LK22:** the chapter run in Learn (pick a chapter, pick a time, the mix adjusts) is "quite good". The direction is right but needs a lot of refinement; many screens have too much blank space.
- **LK23:** build the whole feature completely now: test everything, fix every issue, refine the UI/UX and the logic, make it more useful, using the systems already around it. Then tell him what is needed from him and his next steps.


## 1 Nov 2026, about 4:05 pm IST: his first live look at Learn v2, the Explore feed and the home page (verbatim)

> Okay, I can give you brief feedback only right now. I didn't have much time, but I think you will get some direction from it and see what exactly to do.
>
> * The UI on the phone, the website part, is a bit too cluttered. I am talking about the web mobile experience, not the mobile app. I have not seen what you have done on the mobile app that you can do yourself.
> * When the Google Play Store app is ready for the update, you can make a fresh release right now of the new Google Play app.
> * In the Learn Your Way section, Explore, Saved, and All are in the top tab for horizontal scroll in the Practice section. It's a good approach, but I don't know. It seems a bit confusing for a first-time visitor of the site.
> * When going to the Learn section, there should also be something like a CTA or an offer, a straight thing you can do, like actually learn some stuff. It should not show on top: "Just do today: 0 in, revise 0 mistakenly." Revise should not be 0. It should show "Start learning for the subject," "Your roadmap," or something like that. You can think about it.
> * Overall, the UI on the phone is a bit slow, and the website is also a bit slow.
> * One small thing I'll tell you, from which you can see what I'm saying: when I go to the Explore feed and start something there, the section is designed like an Instagram story thing, but I have to actually swipe down. For a first-time user, you have to somehow integrate this through the UI, or show some toggle or hover first time to nudge them that this is the way to operate it. These kinds of things you have to think about.
> * Overall, there is too much blank space, which can be utilized somehow, maybe.
> * When it is ended, there are also too many lines and walls of text everywhere. We should not have it.
> * I'll just go to the home page once, and I'll sign out.
> * The hero section design: love the direction, but maybe we can consume a bit less of the details space there, like 10%, 20%, and make it a bit more branded somehow, rather than this vague SVG and PNG integration. Maybe make it reactive on tapping something, tapping on the mobi or stuff like that. We had many assets for the animation and promotion videos that we used, so these kinds of things you can take care of.
> * Overall, right now our goal is to work on this feature and, again, keep making the entire UI/UX better to the point when you are satisfied with it. Not only the UI/UX, but the overall usefulness of every feature also.
> * Even if that part is done, you can start populating it more, like adding more cards and more things for the subjects. I think the content is not exactly populated for all subjects and chapters, so it should be at least fine, maybe 1 to 2 hours, 3 hours bare minimum for each subject. This is the bare minimum, even if a subject has 100+ hours of study content, and also it's not an issue.
> * Keep going. You have a bit of a direction and a taste of what I have wanted initially. Now you have to double down on it.

**Transcription guesses (confirm):**
- "Just do today: 0 in, revise 0 mistakenly" is probably the top status line, which reads something like "Today: 0 due · Revise 0 mistakes".
- "Learn Your Way" is the Learn home's heading or section.
- "I'll just go to the home page once, and I'll sign out" means he looked at the home page (the hero) signed out.

**Folded in** (OWNER-MASTER-LEDGER.md, section "Learn v2 live, 1 Nov afternoon"):

| ID | Item |
|---|---|
| LK24 | The phone website (web on a phone, not the app) is too cluttered. |
| LK25 | Ship a fresh Google Play release of the app as soon as the app update is ready. |
| LK26 | The Explore / Saved / All top tabs (horizontal scroll) confuse a first-time visitor. |
| LK27 | Learn opens with a clear offer to start learning ("Start learning <subject>", "Your roadmap"), never a status line full of zeros ("0 due, Revise 0"). |
| LK28 | The phone website and the website are slow. Make them fast. |
| LK29 | The Explore feed works like a story, but it moves by swiping down. A first-time user gets a nudge that shows how it works. Think about such first-time cues everywhere. |
| LK30 | Too much blank space; use it. |
| LK31 | End screens: too many lines and walls of text. |
| LK32 | Home hero: he loves the direction. Use 10-20% less space for the details. Make it more branded, with less vague SVG/PNG. Make it react to taps (for example on Mobi), using our animation and promo-film assets. |
| LK33 | Goal: keep improving this feature and the whole UI/UX, and the usefulness of every feature, until we are satisfied. |
| LK34 | Content: populate cards (and more) for every subject and chapter. At least 3 hours of study per subject is the bare minimum, and more is fine. |
| LK35 | Keep going, and double down on this direction. |

**Content calls still open:** the near-duplicate pair "Define partnership." / "What is partnership?", and the card "If this amount is paid to the old partners...". He did not answer them; the CTO decides in round 2 (LK35: keep going).

## 2 Nov 2026, about 10 am IST: his look at the live Learn v2 on the web, Light and Dark, phone and desktop, while 1.0.19+17 waits in Play review (verbatim, two messages)

> Coming on to the UI: the overall UI and everything, when I go to the account section, it looks good. It's quite detailed. All chapters are properly listed but I don't think that's true for all the subjects. Especially I feel like English: it's just the verbal ability. I don't know, either maybe it's not populated or something.
>
> If I click on "Directly Start 10 Minutes," it's not letting me alter it. If I click on any chapter then I can choose the key cards question but there should be a toggle allowing me to choose the number of key cards and questions and other stuff which I want to do. According to that it can adapt to something like your mistakes and all those kinds of stuff.
>
> Overall I'll start it and see how it is. When I click "Missed It," it's showing "To Revise" and "Open Mistakes 1" only. When I click "Missed It," nothing really happens. Can you explain to me what the "Missed It" button is doing? "Got It" and "Easy" both, I think, are doing the same. Both are adding cards to the "To Revise" section, like 3 to revise, 4 to revise. Those are also, I think, overall the same only, not doing anything. What's the purpose of any of this?
>
> I just feel like the UI of the cards can be a bit better. Right now I'm in light mode. I'll see it one time in dark mode also. The scroll and other small things, like in the section when I'm scrolling: in the question section it's not scrolling the page. I have to scroll outside the question section. Small UI things like this.
>
> Overall everything is very scaled down. There is so much white space, blank space on the desktop, overall everywhere in this thing. Now if I start a 5-minute... Even in dark mode the look of the cards can be improved somehow. They are very boring right now and can be made a bit interesting somehow.
>
> Genuinely people should be able to understand what these three options do. Misstate got it easy. Even I have attempted so many and I am unable to understand. Stuff like this you have to take care of and think about. Overall small UI/UX fixes which I told you about long back have to be done.
>
> In the top bar where it shows Pro, and I think it's credits, wallet symbol, all that is very low-quality, lower UI, which has to be fixed. In dark mode there is this neon light around every card, which is looking a bit too much and can be made a bit more subtle to give it less of a very extreme neon AI slop look.
>
> Going on to the Explore feed, the UI and overall direction that you have taken with this Explore feed is actually better. I just randomly noticed it while attempting many questions: how is the answer to every question just A? I'm randomly clicking, and every answer seems to be A to me. These are not shuffled, or this has to be some major glitch. Just C to me. This is a unique experience just to me. Literally, I have attempted many questions in different sections, different chapters. Every answer seems to be A

> Perform these changes you told me about. You can fix whatever fixes you told me about, like 2, 3, and 4.
>
> For the first one, 4 equal tabs seem okay to me on the web. No specific change but I'll just see it on the mobile app once, if there is anything.
>
> Overall I don't know why the scroll speed on the entire website feels like a lot. Is there any way we can slow it down? It's the issue in the first section of the website only. I don't know, this is a very small thing but I just thought I should mention it.
>
> I think you have copied the exact app UI to the web only. It's not an issue, overall it looks good but it's making the website even less dense, which I think enhances the overall experience. I think many options now are hidden or you are unable to access them. Let me just confirm if that's the case or not.
>
> I think the order maybe can be suggested as practice, then paper, then learn, then explore, rather than the current order. It's a minor thing but it's worth mentioning. The overall UI looks honestly fine only to me. Just the top nav bar can be redesigned and rethought, especially this wallet logo, which looks a bit weird, not as much on the web but still. Apart from that, no specific feedback from my side if anything else is required later.
>
> For the app, it's still in review by Google Play. I don't know how much time it will take. Most probably, I won't be able to give the review right now. Let me know if you need anything right now from my side.

"Fixes 2, 3 and 4" are the app port session's proposals of 2 Nov ~9:40 am: (2) the stop sheet and the end count the same thing; (3) the app's "Print sheet" row is named for what it opens; (4) a Revise run's head line says Revise, not the first card's chapter.
Found at once: the verified bank's keys are skewed to A (Accountancy 1,206 of 1,405; most older subjects alike; the Claude-authored waves are balanced). NTA papers shuffle options; quick papers, Learn v2, the Explore stream and Mob papers serve the stored order.

## 3 Nov 2026, about 1:30 pm IST: his look at the app on his phone, main account (verbatim)

> I was seeing the app. Overall, things look good to me. Only the UI part can be improved a bit in many places.
>
> There is something on my main account. It is always showing on every screen: "Sending your answer is computer science mock." What is this? It is some glitch which needs to be fixed.
>
> The practice section on the mobile app looks clean. Your papers and Learn are there, but there is no Flow feed, and the Learn section is still a bit cluttered. The UI needs a bit of improving. In the overall app, even though I really like the aspects which are implemented right, they can be a bit stronger and a bit more premium, something in the direction of Duolingo.
>
> Except for this, just keep noting whichever things you need my feedback on. I'll be back in 30, 40 minutes, and I'll give you that. Right now, just focus on the things that I just said and the things that you were doing yesterday before I stopped you. Continue doing all that, and when I'm back, I'll tell you whatever you need from my side.

"Sending your answer is computer science mock" is the app's live strip ("Sending your answers · Computer Science mock"; flutter_app/lib/core/widgets/bar/bar_live.dart BarSending). It shows whenever the latest local session draft has pendingSubmission and the phone is online (app_overrides.dart barSendingInputProvider), even after the submit window (endsAt + 120 s) has passed or after the token refresher gave up, so a stale draft keeps it up on every screen. "Flow feed" is the Explore feed (the web's fourth tab), which the app does not have yet.

