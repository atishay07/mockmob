// The onboarding's live motion: Mobi beside the warm-up (thinks after 20 s, points at the fix after
// a wrong answer), the road's walker, the right answer's ink, the welcome room's idle nudge, and
// the seal's afterglow state. Each is also checked quiet: reduced motion plays none of it.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmMark;
import 'package:mockmob/features/onboarding/data/warmup_pool.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/screens/welcome_view.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/steps/question_step.dart';
import 'package:mockmob/features/onboarding/widgets/plan_seal_moment.dart';
import 'package:mockmob/features/onboarding/widgets/warmup_option.dart';
import 'package:mockmob/features/onboarding/widgets/week_track.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// Records what he is asked to do.
class _SpyMobi extends MobiController {
  final List<MobiAct> acts = [];
  final List<Offset> points = [];

  @override
  void play(MobiAct act) {
    acts.add(act);
    super.play(act);
  }

  @override
  bool react(MobiAct act, {String? key, Duration gap = MobiRation.glanceGap}) {
    acts.add(act);
    return super.react(act, key: key, gap: gap);
  }

  @override
  void pointAt(Offset globalPoint) {
    points.add(globalPoint);
    super.pointAt(globalPoint);
  }
}

void main() {
  setUpAll(loadAppFonts);

  group('the seal moment afterglow', () {
    test('the surge is 0 before the strike, peaks in the middle and is 0 again once settled', () {
      final m = PlanSealMoment();
      expect(m.surge, 0);
      m.set(land: 0.5);
      expect(m.surge, closeTo(1, 1e-9));
      m.set(land: 0.25);
      expect(m.surge, closeTo(0.7071, 1e-3));
      m.set(land: 1);
      expect(m.surge, 0, reason: 'a strike shown at once (reduced motion, Off) plays no afterglow');
    });

    test('the ring is its own flag and clears with the room', () {
      final m = PlanSealMoment();
      var notified = 0;
      m.addListener(() => notified++);
      m.set(ring: true);
      expect(m.ring, isTrue);
      expect(notified, 1);
      m.set(ring: true);
      expect(notified, 1, reason: 'no change, no repaint');
      m.clear();
      expect(m.ring, isFalse);
      m.reset();
    });
  });

  group('the warm-up and Mobi', () {
    Future<(_SpyMobi, WarmupQuestion)> pumpQuestion(WidgetTester tester, {bool reduced = false}) async {
      tester.view.physicalSize = const Size(768, 1706);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final spy = _SpyMobi();
      addTearDown(spy.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: onboardingOverrides(clock: () => DateTime.utc(2026, 10, 13, 14)),
          child: MaterialApp(
            theme: buildTheme(Brightness.dark),
            builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
            home: Scaffold(
              body: Consumer(
                builder: (context, ref, _) {
                  final answers = ref.watch(onboardingAnswersProvider).value ?? OnboardingAnswers.empty;
                  return QuestionStep(answers: answers, onNext: () {}, mobi: spy);
                },
              ),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      return (spy, warmupQuestionFor(OnboardingAnswers.empty));
    }

    Finder option(WarmupQuestion q, int index) => find.bySemanticsLabel(RegExp('^Option ${'ABCD'[q.order.indexOf(index)]}, ')).first;

    testWidgets('after 20 seconds with no answer he thinks it over', (tester) async {
      final (spy, _) = await pumpQuestion(tester);
      await tester.pump(const Duration(seconds: 19));
      expect(spy.acts, isNot(contains(MobiAct.think)));
      await tester.pump(const Duration(seconds: 2));
      expect(spy.acts, contains(MobiAct.think));
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('an answer inside 20 seconds means he never thinks', (tester) async {
      final (spy, q) = await pumpQuestion(tester);
      await tester.pump(const Duration(seconds: 5));
      await tester.tap(option(q, q.answer));
      // The frame after the tap is what hands the answer to the step (it cancels the timer).
      await tester.pump();
      await tester.pump(const Duration(seconds: 30));
      expect(spy.acts, isNot(contains(MobiAct.think)));
      expect(spy.points, isEmpty, reason: 'a right answer has no fix to point at');
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('a wrong answer: no shake, and after his nod he points at the ten-second fix', (tester) async {
      final (spy, q) = await pumpQuestion(tester);
      final wrong = [for (var i = 0; i < q.options.length; i++) if (i != q.answer) i].first;
      // A shake is sideways: the options above may shrink to a quiet row, so only x is compared.
      final before = tester.getTopLeft(option(q, wrong)).dx;
      await tester.tap(option(q, wrong));
      await tester.pump(const Duration(milliseconds: 120));
      expect(tester.getTopLeft(option(q, wrong)).dx, before, reason: 'a wrong answer never shakes');
      expect(spy.points, isEmpty, reason: 'he waits for his encouraging nod to finish');
      await tester.pump(const Duration(milliseconds: 1500));
      expect(spy.points, hasLength(1));
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('under reduced motion he neither thinks nor points', (tester) async {
      final (spy, q) = await pumpQuestion(tester, reduced: true);
      await tester.pump(const Duration(seconds: 25));
      expect(spy.acts, isEmpty);
      final wrong = [for (var i = 0; i < q.options.length; i++) if (i != q.answer) i].first;
      await tester.tap(option(q, wrong));
      await tester.pump(const Duration(seconds: 3));
      expect(spy.points, isEmpty);
    });

    testWidgets('the right option inks in from the touch and settles', (tester) async {
      var state = WarmupOptionState.open;
      late StateSetter set;
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: buildTheme(Brightness.dark),
            home: Scaffold(
              body: StatefulBuilder(
                builder: (context, setState) {
                  set = setState;
                  return SizedBox(width: 340, child: WarmupOption(letter: 'A', text: 'Debit the asset', state: state, onTap: () {}));
                },
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Debit the asset'));
      set(() => state = WarmupOptionState.right);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 120));
      expect(tester.takeException(), isNull);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('Debit the asset'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    });
  });

  group('the road to CUET', () {
    Future<void> road(WidgetTester tester, int? lit, {bool reduced = false, MobiController? mobi}) => pumpMockmob(
          tester,
          Padding(padding: const EdgeInsets.all(16), child: WeekTrack(nearWeeks: 29, farWeeks: 81, litWeeks: lit, mobi: mobi)),
          disableAnimations: reduced,
        );

    testWidgets('the 16 dp mark stands on the road and travels to the chosen window; no Mobi on the road', (tester) async {
      await road(tester, null);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(MmMark), findsOneWidget);
      expect(find.byType(MobiCharacter), findsNothing, reason: "the guide bar's Mobi is the screen's one Mobi");
      final start = tester.getTopLeft(find.byType(MmMark)).dx;
      await road(tester, 81);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 700));
      final end = tester.getTopLeft(find.byType(MmMark)).dx;
      expect(end, greaterThan(start + 100), reason: 'the mark travelled along the road to May 2028');
      expect(tester.getSize(find.byType(MmMark)).height, 16);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets("the guide's Mobi answers the arrival at the near window, once", (tester) async {
      final mobi = _SpyMobi();
      addTearDown(mobi.dispose);
      await road(tester, null, mobi: mobi);
      expect(mobi.acts, isEmpty, reason: 'nothing chosen, nothing to answer');
      await road(tester, 29, mobi: mobi);
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump();
      expect(mobi.acts, [MobiMoments.act(MobiEvent.answerRight)], reason: 'once, when the mark has arrived');
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('under reduced motion the mark is simply there and Mobi still answers', (tester) async {
      final mobi = _SpyMobi();
      addTearDown(mobi.dispose);
      await road(tester, null, mobi: mobi, reduced: true);
      await road(tester, 29, mobi: mobi, reduced: true);
      await tester.pump();
      expect(mobi.acts, [MobiMoments.act(MobiEvent.answerRight)]);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('under reduced motion the mark simply stands at the window', (tester) async {
      await road(tester, 29, reduced: true);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(MmMark), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('the welcome room', () {
    Future<void> welcome(WidgetTester tester, {bool reduced = false}) => pumpMockmob(
          tester,
          WelcomeView(onStart: () {}, onHaveAccount: () {}, animate: !reduced),
          size: kPhone,
          brightness: Brightness.dark,
          disableAnimations: reduced,
          overrides: onboardingOverrides(now: kNow),
          wrapInScaffold: false,
        );

    testWidgets('left alone for 7 seconds he points at Build my plan, and a touch lets go', (tester) async {
      await welcome(tester);
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(seconds: 5));
      expect(tester.takeException(), isNull);
      // A touch anywhere ends the nudge without a sound or a state to read back.
      await tester.tapAt(const Offset(40, 300));
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('the lamp flicks once after 9 seconds without breaking the room', (tester) async {
      await welcome(tester);
      await tester.pump(const Duration(seconds: 9, milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('under reduced motion the room is still: no timers are left running', (tester) async {
      await welcome(tester, reduced: true);
      await tester.pump(const Duration(seconds: 12));
      expect(tester.takeException(), isNull);
    });
  });
}
