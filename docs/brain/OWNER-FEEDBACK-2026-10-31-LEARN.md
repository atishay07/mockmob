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
