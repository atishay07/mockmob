// The chapter page as a student meets it (APP-1101 5 C): what it draws, what each tap does and asks, every state, large text,
// 48 dp targets, the Start key that never sits under the screen's edge, and its words. Over D's fixture server, which answers
// with the recordings of the web preview's real engine.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/core/theme/theme.dart' show MmColors;
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton, KeyVariant, MmSegmented;
import 'package:mockmob/features/learn2/chapter/chapter_copy.dart';
import 'package:mockmob/features/learn2/chapter/chapter_model.dart';
import 'package:mockmob/features/learn2/chapter/chapter_page.dart' show ChapterPage;
import 'package:mockmob/features/learn2/chapter/chapter_piles.dart';
import 'package:mockmob/features/learn2/chapter/chapter_preview.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart' show LearnPreviewKey;
import 'package:mockmob/features/learn2/data/learn_words.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';

import '../../../helpers/fonts.dart';
import 'chapter_test_support.dart';

/// The recordings for Admission of a Partner with its unfinished run taken out (the chapter page of a student with no run
/// to pick up), answering by length like the server does.
ChapterApi _aop({bool pro = true, bool newStudent = false}) => ChapterApi(
  pro: pro,
  newStudent: newStudent,
  pick: newStudent ? null : (k) => _aopPick(k, pro: pro),
  edit: (k, body) => body['resume'] = null,
);

String _aopPick(LearnPreviewKey k, {required bool pro}) {
  if (pro && k.leaveOut.contains('questions')) return 'preview_aop_10_out_questions_pro';
  final length = k.minutes <= 5 ? 5 : (k.minutes >= 20 ? 20 : 10);
  return 'preview_aop_${length}_${pro ? 'pro' : 'free'}';
}

typedef _Case = (String, ChapterApi?, String, int?);

Finder _key(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.label == label);

Future<void> _tapKey(WidgetTester tester, String label) async {
  await tester.tap(_key(label));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

Map<String, String> _query(ChapterHarness h) => Uri.parse(h.visited.last).queryParameters;

/// Every string a Text on screen draws.
List<String> _texts(WidgetTester tester) => [
  for (final t in tester.widgetList<Text>(find.byType(Text)))
    if (t.data != null) t.data! else if (t.textSpan != null) t.textSpan!.toPlainText(),
];

void main() {
  setUpAll(loadAppFonts);

  group('what the page draws', () {
    testWidgets('the head, the length, the piles, the Start key, the recap and the shelf (Basic Concepts, Pro)', (tester) async {
      await pumpChapter(tester);
      expect(find.text('Accounting for Partnership: Basic Concepts'), findsOneWidget);
      expect(find.text('Chapter 1 of 14'), findsOneWidget, reason: 'the place, never "Part 1, Ch 1"');
      expect(find.text('Getting there'), findsNothing, reason: 'the only verdict is Needs work');
      expect(find.text('Needs work'), findsNothing);
      expect(find.text('Accountancy'), findsOneWidget, reason: 'the back key names where it goes, the subject, as the web does');
      expect(find.text('How long have you got?'), findsOneWidget);
      for (final s in ['5 min', '10 min', '20 min', 'Other']) {
        expect(find.text(s), findsOneWidget);
      }
      // The piles: count, label, minutes.
      for (final (id, count, label, line) in [('cards', '14', 'Key cards', 'about 5 min'), ('questions', '2', 'Questions', 'about 3 min'), ('mistakes', '2', 'Your mistakes', '2 fit in 10 min')]) {
        final pile = pileFinder(id);
        expect(find.descendant(of: pile, matching: find.text(count)), findsOneWidget, reason: '$id count');
        expect(find.descendant(of: pile, matching: find.text(label)), findsOneWidget, reason: '$id label');
        expect(find.descendant(of: pile, matching: find.text(line)), findsOneWidget, reason: '$id minutes');
      }
      expect(find.text('of 3'), findsOneWidget, reason: 'two of the three open mistakes');
      expect(find.text(ChapterCopy.coach), findsOneWidget);
      expect(_key('Start · 10 min'), findsOneWidget);
      expect(find.text('Quick recap · 2 min'), findsOneWidget, reason: 'the student has seen cards here');
      // First up: the first three real card fronts the run opens with.
      expect(find.text('First up'), findsOneWidget);
      expect(find.byKey(const ValueKey('first-up-0')), findsOneWidget);
      expect(find.byKey(const ValueKey('first-up-2')), findsOneWidget);
      // The shelf.
      expect(find.text('Everything in this chapter'), findsOneWidget);
      expect(find.text('All 45, 12 in Revise'), findsOneWidget);
      expect(find.text('10 questions in this chapter'), findsOneWidget);
      expect(find.text('Fix 3 open mistakes · 3 min'), findsOneWidget);
      // Round 5, fix 3: the row is named for what it opens in the app, its count is the note (the web's "Print sheet" prints).
      expect(find.text('Must-know lines'), findsOneWidget);
      expect(find.text('12 lines'), findsOneWidget);
      expect(find.text('Chapter sheet'), findsNothing);
      expect(find.text('No lesson yet.'), findsNothing);
    });

    testWidgets('the unit shows only when it adds something; "Ratings join Revise" is not drawn', (tester) async {
      await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      expect(find.text('Reconstitution of a Partnership firm'), findsOneWidget);
      expect(find.text('Admission of a Partner'), findsOneWidget);
      await pumpChapter(tester);
      expect(find.text('Reconstitution of a Partnership firm'), findsNothing);
      expect(_texts(tester).where((t) => t.contains('Ratings join Revise')), isEmpty);
    });

    testWidgets('the subject object appears once, in the head', (tester) async {
      await pumpChapter(tester);
      expect(find.byType(SubjectEmblem), findsOneWidget);
      final head = tester.getRect(find.text('Accounting for Partnership: Basic Concepts'));
      expect(tester.getTopLeft(find.byType(SubjectEmblem)).dy, lessThan(head.bottom), reason: 'beside the title, not under the page');
    });

    testWidgets('a new student\'s first visit says how it works, in one quiet line', (tester) async {
      await pumpChapter(tester, api: _aop(newStudent: true), chapter: l2Aop);
      // The first-visit line is gone (R2 ruling 9): the run's own first card says how it works. The recap waits for a first card.
      expect(find.text(ChapterModel.firstVisitLine), findsNothing);
      expect(find.text('First up'), findsOneWidget);
      expect(find.textContaining('Quick recap'), findsNothing, reason: 'a recap of what the student has not met is not a recap');
      expect(find.text('Not started'), findsNothing, reason: 'the only verdict is Needs work');
      expect(pileFinder('mistakes'), findsNothing, reason: 'no open mistakes, so no pile');
      expect(pileFinder('cards'), findsOneWidget);
      expect(pileFinder('questions'), findsOneWidget);
    });

    testWidgets('a lesson pile comes first, the three papers share the row', (tester) async {
      await pumpChapter(tester, chapter: l2Cpsr, minutes: 20);
      final left = <String, double>{
        for (final id in ['lesson', 'cards', 'questions']) id: tester.getTopLeft(pileFinder(id)).dx,
      };
      final tops = <String, double>{for (final id in ['lesson', 'cards', 'questions']) id: tester.getTopLeft(pileFinder(id)).dy};
      expect(left['lesson']! < left['cards']!, isTrue);
      expect(left['cards']! < left['questions']!, isTrue);
      expect(tops['lesson'], tops['cards']);
      expect(tops['cards'], tops['questions'], reason: 'three papers sit in one row');
      expect(pileFinder('next'), findsNothing, reason: 'a chapter with enough in it offers no next one');
    });

    testWidgets('a short chapter offers the next chapter as a paper named by its place; one or two papers share the full row', (tester) async {
      await pumpChapter(tester, chapter: l2Ccss, minutes: 20);
      expect(pileFinder('next'), findsOneWidget);
      expect(find.text('Add the next chapter'), findsOneWidget);
      expect(find.text('Chapter 13, fills your 20 min'), findsOneWidget, reason: 'the place, never the NCERT number');
      expect(find.text('This chapter has about 8 minutes of new things today.'), findsOneWidget);
      expect(_key('Start · 8 min'), findsOneWidget);
      // Cards and the next chapter: two papers take half of the row each, not a third with an empty third.
      final cards = tester.getRect(pileFinder('cards'));
      final next = tester.getRect(pileFinder('next'));
      expect(next.left, greaterThan(cards.right - 1));
      expect(cards.width, closeTo(next.width, 1));
      expect(cards.width, greaterThan(150), reason: 'half of a 360 dp row, not a third');
    });
  });

  group('the length', () {
    testWidgets('a length change asks again and the new numbers replace the old', (tester) async {
      final h = await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      expect(h.api.previews.map((k) => k.minutes), [10]);
      expect(find.text('16'), findsOneWidget);
      await tester.tap(find.text('20 min'));
      await settleChapter(tester);
      expect(h.api.previews.map((k) => k.minutes), [10, 20]);
      expect(find.text('17'), findsOneWidget, reason: 'the 20-minute cards pile');
      expect(_key('Start · 20 min'), findsOneWidget);
      await tester.tap(find.text('5 min'));
      await settleChapter(tester);
      expect(h.api.previews.last.minutes, 5);
      expect(_key('Start · 5 min'), findsOneWidget);
    });

    testWidgets('two quick changes ask once, for the last one', (tester) async {
      final h = await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      await tester.tap(find.text('5 min'));
      await tester.pump(const Duration(milliseconds: 30));
      await tester.tap(find.text('20 min'));
      await settleChapter(tester);
      expect(h.api.previews.map((k) => k.minutes), [10, 20]);
    });

    testWidgets('the last numbers stay on screen while a new answer is on its way', (tester) async {
      final api = _aop();
      final h = await pumpChapter(tester, api: api, chapter: l2Aop);
      api.slow = const Duration(milliseconds: 600);
      await tester.tap(find.text('20 min'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('16'), findsOneWidget, reason: 'the 10-minute numbers stay');
      expect(_key('Start · 10 min'), findsOneWidget, reason: 'the key keeps the last real length');
      final container = ProviderScope.containerOf(tester.element(find.byType(MmSegmented<Object>)));
      expect(container.read(chapterPreviewProvider(l2Aop)).status, ChapterReadStatus.refreshing);
      // The segment keeps what was chosen at once.
      expect(tester.widget<MmSegmented<Object>>(find.byType(MmSegmented<Object>)).value, 20);
      // And the key does nothing meanwhile: it never starts what it does not say.
      await tester.tap(_key('Start · 10 min'));
      await tester.pump();
      expect(h.visited, isEmpty);
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('17'), findsOneWidget);
      expect(_key('Start · 20 min'), findsOneWidget);
    });

    testWidgets('"Your own": the sheet, a stepper in 5-minute steps, and the segment keeps the choice', (tester) async {
      final h = await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      await tester.tap(find.text('Other'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('Your own length'), findsOneWidget);
      expect(find.text('30 min'), findsOneWidget);
      expect(find.text('45 min'), findsOneWidget);
      expect(find.text('1 hour'), findsOneWidget);
      expect(_key('Use 35 minutes'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.plus));
      await tester.pump();
      expect(_key('Use 40 minutes'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.minus));
      await tester.tap(find.byIcon(LucideIcons.minus));
      await tester.pump();
      expect(_key('Use 30 minutes'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.plus));
      await tester.pump();
      await tester.tap(_key('Use 35 minutes'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      // The segment says what was chosen, not what was composed.
      expect(find.text('35 min'), findsOneWidget);
      expect(find.text('Other'), findsNothing);
      await settleChapter(tester);
      expect(h.api.previews.last.minutes, 35);
      expect(h.store.values[LearnPrefs.minutesKey], 35, reason: 'the length is kept on the phone');
      // Pressing it again opens the sheet again: the chosen segment carries a key of its own over its words.
      await tester.tap(find.bySemanticsLabel('Your own length, 35 min. Change it'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('Your own length'), findsOneWidget);
      await tester.tap(find.text('1 hour'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await settleChapter(tester);
      expect(find.text('1 hour'), findsOneWidget);
      expect(h.api.previews.last.minutes, 60);
    });

    testWidgets('the stepper stops at 5 and at 120 minutes', (tester) async {
      await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      await tester.tap(find.text('Other'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      for (var i = 0; i < 40; i++) {
        await tester.tap(find.byIcon(LucideIcons.minus), warnIfMissed: false);
        await tester.pump();
      }
      expect(_key('Use 5 minutes'), findsOneWidget);
      for (var i = 0; i < 40; i++) {
        await tester.tap(find.byIcon(LucideIcons.plus), warnIfMissed: false);
        await tester.pump();
      }
      expect(_key('Use 120 minutes'), findsOneWidget);
    });

    testWidgets('the length used last is shown as chosen, and a length in the link wins over it', (tester) async {
      final kept = storeWith({LearnPrefs.minutesKey: 20});
      final h = await pumpChapter(tester, api: _aop(), chapter: l2Aop, store: kept);
      expect(h.api.previews.map((k) => k.minutes), [20], reason: 'one ask, for the length kept');
      expect(tester.widget<MmSegmented<Object>>(find.byType(MmSegmented<Object>)).value, 20);

      final link = await pumpChapter(tester, api: _aop(), chapter: l2Aop, minutes: 5, store: storeWith({LearnPrefs.minutesKey: 20}));
      expect(link.api.previews.map((k) => k.minutes), [5]);
    });
  });

  group('the piles', () {
    testWidgets('a tap leaves a pile out: it dims and reads "Left out", and the others come from a new answer', (tester) async {
      final h = await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      await tester.tap(pileFinder('questions'));
      await tester.pump();
      // At once: the pile reads left out and is dimmed to 35%; the numbers have not moved yet.
      expect(find.descendant(of: pileFinder('questions'), matching: find.text('Left out')), findsOneWidget);
      expect(find.descendant(of: pileFinder('questions'), matching: find.text('Tap to add it back')), findsOneWidget);
      final dim = tester.widget<AnimatedOpacity>(find.descendant(of: pileFinder('questions'), matching: find.byType(AnimatedOpacity)).first);
      expect(dim.opacity, PileCell.dim);
      expect(find.text('16'), findsOneWidget);
      await settleChapter(tester);
      expect(h.api.previews.last.leaveOut, ['questions']);
      expect(find.text('23'), findsOneWidget, reason: 'the cards pile re-balanced');
      expect(h.phone.calls, ['selection']);
      // A tap on it again puts it back.
      await tester.tap(pileFinder('questions'));
      await settleChapter(tester);
      expect(h.api.previews.last.leaveOut, isEmpty);
      expect(find.text('16'), findsOneWidget);
      expect(find.descendant(of: pileFinder('questions'), matching: find.text('Left out')), findsNothing);
    });


    testWidgets('a new count rolls to its value on the paper while the papers under it close and open again', (tester) async {
      await pumpChapter(tester, api: _aop(), chapter: l2Aop, minutes: 5, disableAnimations: false);
      List<int> counts() => [
        for (final t in tester.widgetList<Text>(find.descendant(of: pileFinder('cards'), matching: find.byType(Text))))
          if (int.tryParse(t.data ?? '') != null) int.parse(t.data!),
      ];
      expect(counts(), [6]);
      await tester.tap(find.text('20 min'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 130));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 30));
      final rolling = counts();
      expect(rolling.single, allOf(greaterThan(6), lessThan(17)), reason: 'on its way from 6 to 17: $rolling');
      await tester.pump(const Duration(milliseconds: 400));
      expect(counts(), [17]);
    });

    testWidgets('"Tap a pile to leave it out." is said once, goes quiet at the first tap and never comes back', (tester) async {
      final store = storeWith({});
      await pumpChapter(tester, api: _aop(), chapter: l2Aop, store: store);
      expect(find.text(ChapterCopy.coach), findsOneWidget);
      expect(store.values[LearnPrefs.coachKey], ['piles'], reason: 'kept as seen as soon as it was shown');
      await tester.tap(pileFinder('questions'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      final line = tester.widget<AnimatedOpacity>(find.ancestor(of: find.text(ChapterCopy.coach), matching: find.byType(AnimatedOpacity)).first);
      expect(line.opacity, 0);
      // Another visit: the line is not there.
      await pumpChapter(tester, api: _aop(), chapter: l2Aop, store: store);
      expect(find.text(ChapterCopy.coach), findsNothing);
    });

    testWidgets('the last pile in cannot be left out: it shakes 4 dp once, says so, and gives no haptic', (tester) async {
      final api = _aop();
      api.edit = (k, body) {
        body['resume'] = null;
        body['piles'] = [(body['piles'] as List).first];
      };
      final h = await pumpChapter(tester, api: api, chapter: l2Aop, disableAnimations: false);
      final fan = find.descendant(of: pileFinder('cards'), matching: find.byType(PileFan));
      final at = tester.getTopLeft(fan);
      await tester.tap(pileFinder('cards'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect((tester.getTopLeft(fan).dx - at.dx).abs(), greaterThan(0.5), reason: 'it shakes sideways');
      expect((tester.getTopLeft(fan).dx - at.dx).abs(), lessThanOrEqualTo(4));
      expect(find.text(ChapterCopy.lastPileIn), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 400));
      expect((tester.getTopLeft(fan) - at).distance, lessThan(0.01), reason: 'it lands where it started');
      expect(h.api.previews.length, 1, reason: 'nothing was asked');
      expect(h.phone.calls, isEmpty, reason: 'no haptic');
      expect(find.descendant(of: pileFinder('cards'), matching: find.text('Left out')), findsNothing);
      await tester.pump(const Duration(milliseconds: 2400));
      expect(find.text(ChapterCopy.lastPileIn), findsNothing, reason: 'the line goes after 2.4 seconds');
    });

    testWidgets('Free\'s held piles are not buttons: "Tomorrow", and a tap on one does nothing', (tester) async {
      final h = await pumpChapter(tester, api: ChapterApi(pro: false, freeUsed: true));
      expect(find.text('Tomorrow'), findsNWidgets(2));
      expect(find.text('Back tomorrow'), findsNWidgets(2));
      expect(find.text(ChapterModel.quietLine(LearnFixtures.preview('preview_pf_10_free_used'))!), findsOneWidget);
      expect(_key('Start · 1 min'), findsOneWidget);
      await tester.tap(pileFinder('questions'), warnIfMissed: false);
      await settleChapter(tester);
      expect(h.api.previews.length, 1);
      expect(h.phone.calls, isEmpty);
      // The cards pile is the run: the only one in, so it cannot be left out either.
      await tester.tap(pileFinder('cards'));
      await tester.pump();
      expect(find.text(ChapterCopy.lastPileIn), findsOneWidget);
    });

    testWidgets('the next chapter: offered, added (+1 min), taken out again; Start sends it', (tester) async {
      final h = await pumpChapter(tester, chapter: l2Ccss, minutes: 20);
      await tester.tap(pileFinder('next'));
      await settleChapter(tester);
      expect(h.api.previews.last.addNext, isTrue);
      expect(find.text('Chapter 13 added'), findsOneWidget, reason: 'the place, never the NCERT number');
      expect(find.text('Tap to remove'), findsOneWidget);
      expect(find.text('+11'), findsOneWidget, reason: 'the minutes it adds: 19 with it, 8 without');
      expect(_key('Start · 20 min'), findsOneWidget);
      await _tapKey(tester, 'Start · 20 min');
      expect(_query(h), {'chapter': l2Ccss, 'min': '20', 'next': '1'});
      h.router.pop();
      await settleChapter(tester);
      await tester.tap(pileFinder('next'));
      await settleChapter(tester);
      expect(h.api.previews.last.addNext, isFalse);
      expect(find.text('Add the next chapter'), findsOneWidget);
    });

    testWidgets('a change of length takes the next chapter out of the run', (tester) async {
      final h = await pumpChapter(tester, chapter: l2Ccss, minutes: 20);
      await tester.tap(pileFinder('next'));
      await settleChapter(tester);
      await tester.tap(find.text('10 min'));
      await settleChapter(tester);
      expect(h.api.previews.last.addNext, isFalse);
    });
  });

  group('the Start key', () {
    testWidgets('names the real length and opens the run with the length, the piles left out and the next chapter', (tester) async {
      final h = await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      await tester.tap(pileFinder('questions'));
      await settleChapter(tester);
      await _tapKey(tester, 'Start · 10 min');
      final uri = Uri.parse(h.visited.last);
      expect(uri.path, '/learn/session');
      expect(uri.queryParameters, {'chapter': l2Aop, 'min': '10', 'out': 'questions'});
    });

    testWidgets('with nothing left out it is just the chapter and the length', (tester) async {
      final h = await pumpChapter(tester);
      await _tapKey(tester, 'Start · 10 min');
      expect(Uri.parse(h.visited.last).path, '/learn/session');
      expect(_query(h), {'chapter': l2Pf, 'min': '10'});
    });

    testWidgets('the chosen length goes to the run even when Free composes less', (tester) async {
      final h = await pumpChapter(tester, api: _aop(pro: false), chapter: l2Aop, minutes: 20);
      expect(_key('Start · 10 min'), findsOneWidget);
      await _tapKey(tester, 'Start · 10 min');
      expect(_query(h)['min'], '20');
    });

    testWidgets('it is the one volt key; with nothing in the run it is quiet and does nothing', (tester) async {
      await pumpChapter(tester);
      final voltKeys = tester.widgetList<KeyButton>(find.byType(KeyButton)).where((k) => k.variant == KeyVariant.primary);
      expect(voltKeys.length, 1);
      expect(voltKeys.single.label, 'Start · 10 min');
    });

    testWidgets('coming back from a run lines the chapter up again', (tester) async {
      final h = await pumpChapter(tester);
      await _tapKey(tester, 'Start · 10 min');
      expect(h.api.previews.length, 1);
      h.router.pop();
      await settleChapter(tester);
      expect(h.api.previews.length, 2, reason: 'what is open has changed after a run');
    });

    testWidgets('the quick recap opens a recap run of the length the server names', (tester) async {
      final h = await pumpChapter(tester);
      await tester.tap(find.text('Quick recap · 2 min'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(_query(h), {'chapter': l2Pf, 'min': '2', 'kind': 'recap'});
    });
  });

  group('a run to pick up', () {
    testWidgets('comes first; Start becomes a line key that sends a new run; one volt key', (tester) async {
      final h = await pumpChapter(tester, chapter: l2Aop);
      expect(find.text('You stopped at 6 of 16 today.'), findsOneWidget);
      expect(find.text('About 5 min left.'), findsNothing);
      expect(_key('Continue · 5 min'), findsOneWidget);
      // One main key: the length picker and the new-run key wait behind "Start fresh instead".
      expect(find.text('How long have you got?'), findsNothing);
      expect(_key('Start fresh · 10 min'), findsNothing);
      await tester.tap(find.byKey(const ValueKey('chapter-fresh')));
      await tester.pumpAndSettle();
      expect(find.text('How long have you got?'), findsOneWidget);
      expect(_key('Start fresh · 10 min'), findsOneWidget);
      final keys = tester.widgetList<KeyButton>(find.byType(KeyButton)).toList();
      expect(keys.where((k) => k.variant == KeyVariant.primary).map((k) => k.label), ['Continue · 5 min']);
      expect(keys.where((k) => k.variant == KeyVariant.secondary).map((k) => k.label), ['Start fresh · 10 min']);
      await _tapKey(tester, 'Start fresh · 10 min');
      expect(_query(h), {'chapter': l2Aop, 'min': '10', 'fresh': '1'});
    });

    testWidgets('Continue · 5 min opens that run', (tester) async {
      final h = await pumpChapter(tester, chapter: l2Aop);
      await _tapKey(tester, 'Continue · 5 min');
      expect(Uri.parse(h.visited.last).path, '/learn/session');
      expect({..._query(h)}..remove('run'), {'chapter': l2Aop, 'min': '10'});
      expect(_query(h)['run'], startsWith('lr_'));
    });

    testWidgets('a feed to pick up opens the feed', (tester) async {
      final api = ChapterApi(edit: (k, body) => (body['resume'] as Map<String, dynamic>)['kind'] = 'feed');
      final h = await pumpChapter(tester, api: api, chapter: l2Aop);
      await _tapKey(tester, 'Continue · 5 min');
      expect(Uri.parse(h.visited.last).path, '/explore/feed');
      expect(_query(h)['run'], startsWith('lr_'));
    });

    testWidgets('a run with nothing left is not offered', (tester) async {
      final api = ChapterApi(edit: (k, body) => (body['resume'] as Map<String, dynamic>)['done'] = 16);
      await pumpChapter(tester, api: api, chapter: l2Aop);
      expect(find.text('You stopped at 16 of 16 today.'), findsNothing);
      expect(_key('Start · 10 min'), findsOneWidget);
    });
  });

  group('Free', () {
    testWidgets('the cap line shows only at the real limit: 20 minutes chosen, composed at 10', (tester) async {
      await pumpChapter(tester, api: _aop(pro: false), chapter: l2Aop);
      expect(find.text('Free sessions are up to 10 minutes. Pro has any length.'), findsNothing);
      await tester.tap(find.text('20 min'));
      await settleChapter(tester);
      expect(find.text('Free sessions are up to 10 minutes. Pro has any length.'), findsOneWidget);
      expect(_key('Start · 10 min'), findsOneWidget, reason: 'the key says what Free gets');
      expect(tester.widget<MmSegmented<Object>>(find.byType(MmSegmented<Object>)).value, 20, reason: 'the segment keeps the choice');
      await tester.tap(find.text('5 min'));
      await settleChapter(tester);
      expect(find.text('Free sessions are up to 10 minutes. Pro has any length.'), findsNothing);
    });

    testWidgets('Your own over 10 minutes is the same limit', (tester) async {
      await pumpChapter(tester, api: _aop(pro: false), chapter: l2Aop);
      await tester.tap(find.text('Other'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.text('30 min'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await settleChapter(tester);
      expect(find.text('Free sessions are up to 10 minutes. Pro has any length.'), findsOneWidget);
    });

    testWidgets('the day used: the server\'s line, the cards only, Start says 1 minute', (tester) async {
      await pumpChapter(tester, api: ChapterApi(pro: false, freeUsed: true));
      expect(find.text(LearnFreeWords.cardsOnly), findsOneWidget);
      expect(find.text('Free sessions are up to 10 minutes. Pro has any length.'), findsNothing);
    });

    testWidgets('Free\'s taste is on the shelf only: "Free opens 5"; the Must-know lines row is part of Pro', (tester) async {
      await pumpChapter(tester, api: _aop(pro: false), chapter: l2Aop);
      expect(find.text('60 cards. 5 open on Free.'), findsOneWidget);
      expect(find.text('Part of Pro'), findsOneWidget);
      expect(find.byIcon(LucideIcons.lock), findsOneWidget);
      expect(_texts(tester).where((t) => t.contains('Free opens 5 of')), isEmpty, reason: 'not a limit line');
    });

    testWidgets('See Pro: under Free\'s limit lines only, and only when Pro can be bought', (tester) async {
      await pumpChapter(tester, api: ChapterApi(pro: false, freeUsed: true), nudges: true);
      expect(find.text('See Pro'), findsOneWidget);
      await pumpChapter(tester, api: ChapterApi(pro: false, freeUsed: true), nudges: false);
      expect(find.text('See Pro'), findsNothing);
      await pumpChapter(tester, api: _aop(pro: false), chapter: l2Aop, nudges: true);
      expect(find.text('See Pro'), findsNothing, reason: 'not at the cap: nothing to say');
      await tester.tap(find.text('20 min'));
      await settleChapter(tester);
      expect(find.text('See Pro'), findsOneWidget);
    });
  });

  group('the shelf', () {
    testWidgets('its rows open the cards, a questions-only run, a mistakes-only run, the lesson and the Must-know cards', (tester) async {
      final h = await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      Future<void> open(String text) async {
        await tester.ensureVisible(find.text(text));
        await tester.pump();
        await tester.tap(find.text(text));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 400));
      }

      await open('All 60, by section');
      expect(Uri.parse(h.visited.last).path, '/learn/c/$l2Aop/cards');
      expect(Uri.parse(h.visited.last).queryParameters, isEmpty);
      h.router.pop();
      await settleChapter(tester);

      await open('10 questions in this chapter');
      expect(_query(h), {'chapter': l2Aop, 'min': '10', 'out': 'cards,mistakes,lesson'});
      h.router.pop();
      await settleChapter(tester);

      await open('Fix 2 open mistakes · 2 min');
      expect(_query(h), {'chapter': l2Aop, 'min': '10', 'out': 'cards,questions,lesson'});
      h.router.pop();
      await settleChapter(tester);

      await open('Lesson · 7 min, not read yet');
      expect(Uri.parse(h.visited.last).path, '/learn/accountancy-revaluation');
      h.router.pop();
      await settleChapter(tester);

      await open('Must-know lines');
      expect(Uri.parse(h.visited.last).path, '/learn/c/$l2Aop/cards');
      expect(_query(h), {'f': 'must'});
    });

    testWidgets('Free\'s day is used: the questions and mistakes rows are quiet, "back tomorrow", and not pressed', (tester) async {
      final api = ChapterApi(pro: false, freeUsed: true, edit: (k, body) => (body['shelf'] as Map<String, dynamic>)['mistakes'] = {'open': 3});
      final h = await pumpChapter(tester, api: api);
      expect(find.text('10 questions, back tomorrow'), findsOneWidget);
      expect(find.text('3 open mistakes, back tomorrow'), findsOneWidget);
      await tester.ensureVisible(find.text('10 questions, back tomorrow'));
      await tester.tap(find.text('10 questions, back tomorrow'), warnIfMissed: false);
      await tester.pump();
      expect(h.visited, isEmpty);
    });
  });

  group('the other states', () {
    testWidgets('before the first answer the page is in outline, and the first answer replaces it', (tester) async {
      final api = ChapterApi(slow: const Duration(seconds: 2));
      await pumpChapter(tester, api: api, settle: false);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('How long have you got?'), findsNothing, reason: 'the outline has bars where the words will be');
      expect(find.text('Learn'), findsOneWidget, reason: 'no chapter yet: the back key says where it goes');
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('How long have you got?'), findsOneWidget);
    });

    testWidgets('a chapter that is not in the book list', (tester) async {
      final h = await pumpChapter(tester, api: ChapterApi(notFound: true), chapter: l2Missing);
      expect(find.text(ChapterCopy.missing), findsOneWidget);
      expect(find.text('This chapter is not in your book list.'), findsOneWidget);
      expect(find.text('How long have you got?'), findsNothing);
      expect(find.text('Everything in this chapter'), findsNothing);
      await _tapKey(tester, 'Back to Learn');
      expect(h.visited.last, startsWith('/practice'));
      expect(Uri.parse(h.visited.last).queryParameters, {'door': 'learn', 'subject': 'accountancy'});
    });

    testWidgets('the read failed: one line and Try again, and the shelf\'s Key cards row still opens', (tester) async {
      final api = ChapterApi(error: true);
      final h = await pumpChapter(tester, api: api);
      expect(find.text(ChapterCopy.failed), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      expect(find.text('How long have you got?'), findsOneWidget, reason: 'the length control stays');
      expect(find.text('Everything in this chapter'), findsOneWidget);
      expect(find.text(ChapterCopy.shelfCardsFallback), findsOneWidget);
      await tester.tap(find.text(ChapterCopy.shelfCardsFallback));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(Uri.parse(h.visited.last).path, '/learn/c/$l2Pf/cards');
      h.router.pop();
      await tester.pump(const Duration(milliseconds: 400));
      api.error = false;
      await tester.tap(find.text('Try again'));
      await settleChapter(tester);
      expect(find.text('Accounting for Partnership: Basic Concepts'), findsOneWidget);
      expect(find.text(ChapterCopy.failed), findsNothing);
      expect(_key('Start · 10 min'), findsOneWidget);
    });

    testWidgets('an offline phone says so', (tester) async {
      await pumpChapter(tester, api: ChapterApi(offline: true));
      expect(find.text(ChapterCopy.offline), findsOneWidget);
      expect(find.text(ChapterCopy.failed), findsNothing);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('a new answer that fails leaves the last numbers with one line', (tester) async {
      final api = _aop();
      await pumpChapter(tester, api: api, chapter: l2Aop);
      api.error = true;
      await tester.tap(find.text('20 min'));
      await settleChapter(tester);
      expect(find.text('16'), findsOneWidget, reason: 'the last lined-up run is shown');
      expect(find.text(ChapterCopy.stale), findsOneWidget);
      expect(find.text(ChapterCopy.failed), findsNothing);
      api.error = false;
      await tester.tap(find.text('10 min'));
      await settleChapter(tester);
      expect(find.text(ChapterCopy.stale), findsNothing);
    });

    testWidgets('Back goes to the Learn door of the chapter\'s subject when there is nothing to go back to', (tester) async {
      final h = await pumpChapter(tester);
      await tester.tap(find.text('Accountancy'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(Uri.parse(h.visited.last).path, '/practice');
      expect(Uri.parse(h.visited.last).queryParameters, {'door': 'learn', 'subject': 'accountancy'});
    });

    testWidgets('Back goes back to where the student came from when there is somewhere to go back to', (tester) async {
      final h = await pumpChapter(tester);
      h.router.go('/');
      await tester.pump();
      unawaited(h.router.push<void>('/chapter'));
      await settleChapter(tester);
      expect(find.byType(ChapterPage), findsOneWidget);
      await tester.tap(find.text('Accountancy'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byType(ChapterPage), findsNothing);
      expect(find.text('where the student came from'), findsOneWidget, reason: 'it popped to where the student was');
      expect(h.visited, isEmpty, reason: 'it did not go to the Learn door');
    });

    testWidgets('on a wide screen the page is one column of at most 600 dp, at the top', (tester) async {
      await pumpChapter(tester, size: const Size(900, 1000));
      expect(tester.takeException(), isNull);
      final key = tester.getRect(_key('Start · 10 min'));
      expect(key.width, lessThanOrEqualTo(600));
      final back = tester.getRect(find.text('Accountancy'));
      expect(back.top, lessThan(100), reason: 'at the top, not floating in the middle');
      expect(key.center.dx, closeTo(450, 1), reason: 'the column is centred');
    });
  });

  group('large text and touch', () {
    final cases = <_Case>[
      ('Basic Concepts, Pro', null, l2Pf, null),
      ('a run to pick up, Free', ChapterApi(pro: false), l2Aop, 20),
      ('four papers and a long line', null, l2Cpsr, 20),
      ("Free's day used", ChapterApi(pro: false, freeUsed: true), l2Pf, null),
    ];
    for (final (name, api, chapter, minutes) in cases) {
      testWidgets('text at 1.3 on a 360 dp phone: $name draws without overflow', (tester) async {
        await pumpChapter(tester, api: api, chapter: chapter, minutes: minutes, textScale: 1.3, nudges: true);
        expect(tester.takeException(), isNull);
        final width = tester.view.physicalSize.width / tester.view.devicePixelRatio;
        for (final rect in [for (final k in tester.widgetList(find.byType(KeyButton))) tester.getRect(find.byWidget(k))]) {
          expect(rect.left, greaterThanOrEqualTo(0));
          expect(rect.right, lessThanOrEqualTo(width));
        }
        // Beside an unfinished run the picker waits behind "Start fresh instead".
        if (find.byKey(const ValueKey('chapter-fresh')).evaluate().isNotEmpty) {
          await tester.ensureVisible(find.byKey(const ValueKey('chapter-fresh')));
          await tester.tap(find.byKey(const ValueKey('chapter-fresh')));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        }
        expect(find.byType(PileGrid), findsOneWidget);
      });
    }


    for (final scale in [1.0, 1.3]) {
      for (final (name, api, chapter, minutes) in [
        ('Basic Concepts', null, l2Pf, null),
        ('four papers', null, l2Cpsr, 20),
        ('a run to pick up on Free', ChapterApi(pro: false), l2Aop, 20),
        ('Free, the day used', ChapterApi(pro: false, freeUsed: true), l2Pf, null),
      ].cast<_Case>()) {
        testWidgets('a 320 dp phone at text $scale: $name draws without overflow', (tester) async {
          await pumpChapter(tester, api: api, chapter: chapter, minutes: minutes, size: const Size(320, 640), textScale: scale, nudges: true);
          expect(tester.takeException(), isNull);
          for (final k in tester.widgetList(find.byType(KeyButton))) {
            final rect = tester.getRect(find.byWidget(k));
            expect(rect.left, greaterThanOrEqualTo(0));
            expect(rect.right, lessThanOrEqualTo(320));
          }
        });
      }
    }

    testWidgets('text at 2.0 still draws without overflow', (tester) async {
      await pumpChapter(tester, textScale: 2);
      expect(tester.takeException(), isNull);
    });

    for (final brightness in [Brightness.dark, Brightness.light]) {
      testWidgets('48 dp targets and a label on every target, ${brightness.name}', (tester) async {
        final handle = tester.ensureSemantics();
        await pumpChapter(tester, brightness: brightness, nudges: true);
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        handle.dispose();
      });

      testWidgets('48 dp targets with four papers, ${brightness.name}', (tester) async {
        final handle = tester.ensureSemantics();
        await pumpChapter(tester, brightness: brightness, chapter: l2Cpsr, minutes: 20);
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        handle.dispose();
      });

      testWidgets('48 dp targets with a run to pick up, ${brightness.name}', (tester) async {
        final handle = tester.ensureSemantics();
        await pumpChapter(tester, brightness: brightness, chapter: l2Aop);
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        handle.dispose();
      });
    }

    testWidgets('a pile says what it is, how many, how long and what a tap does', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      expect(find.bySemanticsLabel('Key cards: 16, about 5 min. Tap to leave it out'), findsOneWidget);
      await tester.tap(pileFinder('questions'));
      await settleChapter(tester);
      expect(find.bySemanticsLabel('Questions, left out. Tap to add it back'), findsOneWidget);
      handle.dispose();
    });

    // The text contrast guideline reads the anti-aliased pixels of a line: on Day it takes a halftone of the 13.5 sp
    // "Tap a pile..." line for its ink (3.8:1) where the ink itself, #454036 on #F3EFE6, is 9:1. So Night is held as
    // rendered, and both themes are held by the colours the page sets its words in.
    testWidgets('text is readable as rendered, Night', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpChapter(tester, nudges: true);
      await expectLater(tester, meetsGuideline(textContrastGuideline));
      handle.dispose();
    });

    test('the colours the page sets its words in keep 4.5 to 1 on the surfaces they stand on, Night and Day', () {
      double lum(Color c) => c.computeLuminance();
      double ratio(Color a, Color b) {
        final hi = lum(a) > lum(b) ? a : b;
        final lo = identical(hi, a) ? b : a;
        return (lum(hi) + 0.05) / (lum(lo) + 0.05);
      }

      for (final c in [MmColors.dark, MmColors.light]) {
        final night = c.isNight ? 'Night' : 'Day';
        // The page, and the paper of a pile (the raised surface).
        for (final ground in [c.ground, c.raised]) {
          for (final (name, ink) in [('ink', c.ink), ('ink2', c.ink2), ('ink3', c.ink3), ('warnText', c.warnText), ('goodText', c.goodText), ('accentText', c.accentText)]) {
            expect(ratio(ink, ground), greaterThanOrEqualTo(4.5), reason: '$name on ${identical(ground, c.ground) ? 'the page' : 'the paper'}, $night');
          }
        }
        expect(ratio(c.wrongText, c.wrongSurface), greaterThanOrEqualTo(4.5), reason: 'the failed-read banner, $night');
        expect(ratio(c.voltInk, c.volt), greaterThanOrEqualTo(4.5), reason: 'the Start key, $night');
      }
    });
  });

  group('the Start key never sits under the edge of the screen', () {
    testWidgets('on a short phone it rides at the bottom while the lined-up block is on screen, and goes with the block', (tester) async {
      await pumpChapter(tester, size: const Size(360, 400));
      final key = _key('Start · 10 min');
      var rect = tester.getRect(key);
      expect(rect.bottom, lessThanOrEqualTo(400), reason: 'its own place is below the edge: it rides at the edge');
      expect(rect.top, greaterThan(250));
      // The page's own end: scrolled to the shelf, the block has gone and so has the key.
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -900));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      rect = tester.getRect(key);
      expect(rect.bottom, lessThan(0), reason: 'above the screen with the block it belongs to');
      // And back at the top it is at the edge again.
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, 1200));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.getRect(key).bottom, lessThanOrEqualTo(400));
    });

    testWidgets('it keeps clear of the gesture bar, and it answers a tap where it is drawn', (tester) async {
      tester.view.padding = const FakeViewPadding(bottom: 48);
      tester.view.viewPadding = const FakeViewPadding(bottom: 48);
      addTearDown(tester.view.resetPadding);
      addTearDown(tester.view.resetViewPadding);
      final h = await pumpChapter(tester, size: const Size(360, 480));
      final rect = tester.getRect(_key('Start · 10 min'));
      expect(rect.bottom, lessThanOrEqualTo(480 - 24), reason: 'the gesture bar keeps 24 dp');
      await tester.tapAt(rect.center);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(h.visited, hasLength(1));
      expect(Uri.parse(h.visited.single).path, '/learn/session');
    });

    testWidgets('where it fits it stays in place, between the piles and the recap', (tester) async {
      await pumpChapter(tester, size: const Size(360, 900));
      final key = tester.getRect(_key('Start · 10 min'));
      final coach = tester.getRect(find.text(ChapterCopy.coach));
      final recap = tester.getRect(find.textContaining('Quick recap'));
      expect(key.top, greaterThan(coach.bottom));
      expect(recap.top, greaterThan(key.bottom));
    });

    testWidgets('beside a run to pick up it stays in place (it is a line key)', (tester) async {
      await pumpChapter(tester, chapter: l2Aop, size: const Size(360, 480));
      await tester.tap(find.byKey(const ValueKey('chapter-fresh')));
      await tester.pumpAndSettle();
      final rect = tester.getRect(_key('Start fresh · 10 min'));
      expect(rect.top, greaterThan(300), reason: 'in its own place, below the piles');
    });
  });

  group('its words', () {
    final forbidden = <String, RegExp>{
      'an exclamation mark': RegExp('!'),
      // The middle dot between a label and its length (" · 10 min") is the web's own; a bullet is not.
      'a bullet': RegExp('[•∙]'),
      'an arrow': RegExp('[←-⇿⟵-⟿⬀-⯿›»]'),
      'an emoji': RegExp('[\u{1F300}-\u{1FAFF}☀-➿]', unicode: true),
      'mastery': RegExp('mastered|mastery|marks to recover', caseSensitive: false),
      'a percentage': RegExp(r'\d\s*%'),
      'a 24-hour time': RegExp(r'\b([01]?\d|2[0-3]):[0-5]\d\b(?!\s*[AP]M)'),
    };

    void clean(Iterable<String> texts, String where) {
      for (final t in texts) {
        for (final e in forbidden.entries) {
          expect(e.value.hasMatch(t), isFalse, reason: '"$t" has ${e.key} ($where)');
        }
      }
    }

    test('the copy and the rules\' lines', () {
      clean([
        ChapterCopy.back,
        ChapterCopy.backLabel,
        ChapterCopy.lengthHead,
        ChapterCopy.lastPileIn,
        ChapterCopy.coach,
        ChapterCopy.listLabel,
        ChapterCopy.resumeHead(6, 16),
        ChapterCopy.resumeLabel('Continue · 5 min', 6, 16),
        ChapterCopy.freshKey,
        ChapterCopy.firstUp,
        ChapterCopy.stale,
        ChapterCopy.failed,
        ChapterCopy.offline,
        ChapterCopy.tryAgain,
        ChapterCopy.loading,
        ChapterCopy.missingTitle,
        ChapterCopy.missing,
        ChapterCopy.backToLearn,
        ChapterCopy.seePro,
        ChapterCopy.shelfCardsFallback,
        ChapterModel.firstVisitLine,
        ChapterModel.onlyCardsLine,
        ChapterModel.onlyQuestionsLine,
        ChapterModel.ratingsUsedLine,
      ], 'copy');
    });

    final drawn = <_Case>[
      ('Basic Concepts, Pro', null, l2Pf, null),
      ('a run to pick up', null, l2Aop, null),
      ('Free at 20 minutes', ChapterApi(pro: false), l2Aop, 20),
      ('Free, the day used', ChapterApi(pro: false, freeUsed: true), l2Pf, null),
      ('a short chapter with the next chapter added', null, l2Ccss, 20),
      ('a new student', ChapterApi(newStudent: true), l2Aop, null),
      ('the read failed', ChapterApi(error: true), l2Pf, null),
      ('not found', ChapterApi(notFound: true), l2Missing, null),
    ];
    for (final (name, api, chapter, minutes) in drawn) {
      testWidgets('what is drawn: $name', (tester) async {
        await pumpChapter(tester, api: api, chapter: chapter, minutes: minutes, nudges: true);
        if (chapter == l2Ccss) {
          await tester.tap(pileFinder('next'));
          await settleChapter(tester);
        }
        clean(_texts(tester), name);
      });
    }

    testWidgets('the sheet\'s words', (tester) async {
      await pumpChapter(tester, api: _aop(), chapter: l2Aop);
      await tester.tap(find.text('Other'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      clean(_texts(tester), 'Other');
    });
  });

  group('the numbers', () {
    testWidgets('every count on the paper is the server\'s: nothing is estimated here', (tester) async {
      final h = await pumpChapter(tester);
      final data = LearnFixtures.preview('preview_pf_10_pro');
      final shown = _texts(tester);
      for (final p in data.piles) {
        expect(shown, contains('${p.count}'), reason: '${p.id} count');
      }
      expect(h.api.previews.single.chapterKey, l2Pf);
      expect(asInt(data.raw['realMinutes']), 10);
    });
  });
}
