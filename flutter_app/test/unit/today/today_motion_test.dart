// Today's motion and press wiring after the UI blitz (blitz audit MOBI-05, MOTION-08, ART-02 and
// the pinned bar's covered keys): the header Mobi nudges once when the screen is left untouched,
// the hero number lands after its card with one selection tick, the resume hero draws its
// subject's emblem without a raster, and the card's keys under the pinned bar are neither
// announced nor tappable.
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiBubble, MobiRation;
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/header_mobi.dart';
import 'package:mockmob/features/today/widgets/hero_stage.dart';
import 'package:mockmob/features/today/widgets/resume_hero.dart';
import 'package:mockmob/features/today/widgets/today_entrance.dart';
import 'package:mockmob/features/today/widgets/week_ledger.dart';

import '../../golden/today/today_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

class _CountingHaptics implements HapticDriver {
  int selections = 0;

  @override
  Future<void> selectionClick() async => selections++;

  @override
  Future<void> lightImpact() async {}

  @override
  Future<void> mediumImpact() async {}
}

void main() {
  setUpAll(loadAppFonts);

  final auth = authSnapshotProvider.overrideWithBuild(
    (ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma'),
  );

  Future<void> pumpToday(WidgetTester tester, {bool reduced = false, HapticDriver? haptics}) => pumpMockmob(
        tester,
        TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero),
        size: const Size(384, 1900),
        disableAnimations: reduced,
        overrides: [
          auth,
          if (haptics != null) hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
        ],
      );

  /// Labels of every node in the live semantics tree (what TalkBack can reach).
  List<String> announced(WidgetTester tester) {
    final out = <String>[];
    bool visit(SemanticsNode node) {
      if (node.label.isNotEmpty) out.add(node.label);
      node.visitChildren(visit);
      return true;
    }

    visit(tester.binding.renderViews.first.owner!.semanticsOwner!.rootSemanticsNode!);
    return out;
  }

  // pumpMockmob plays the first 640 ms (it lets images decode); times below are from the open.
  Future<void> wait(WidgetTester tester, Duration total) async {
    for (var t = Duration.zero; t < total; t += const Duration(milliseconds: 100)) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  group('the header Mobi nudges toward the move card after 4 s, once a day (MOTION 1.3, P0-9)', () {
    late int nudges;
    setUp(() {
      nudges = 0;
      MobiRation.reset();
      HeaderMobi.debugOnNudge = () => nudges++;
    });
    tearDown(() {
      HeaderMobi.debugOnNudge = null;
      MobiRation.reset();
    });

    testWidgets('only after 4 s with nothing touched; never twice', (tester) async {
      HeaderMobi.resetGreeting();
      await pumpToday(tester);
      await wait(tester, const Duration(seconds: 3));
      expect(nudges, 0, reason: 'at 3.6 s it is too soon: sooner reads as nagging');
      await wait(tester, const Duration(seconds: 6));
      expect(nudges, 1);
      await wait(tester, const Duration(seconds: 6));
      expect(nudges, 1, reason: 'once per screen');
    });

    testWidgets('once a day: a second visit the same day does not nudge again', (tester) async {
      await pumpToday(tester);
      await wait(tester, const Duration(seconds: 8));
      expect(nudges, 1);
      await tester.pumpWidget(const SizedBox());
      await pumpToday(tester);
      await wait(tester, const Duration(seconds: 8));
      expect(nudges, 1, reason: 'the gate is per screen per day');
    });

    testWidgets('a touch before 4 s cancels it for good', (tester) async {
      await pumpToday(tester);
      await wait(tester, const Duration(seconds: 2));
      final gesture = await tester.startGesture(const Offset(192, 1500));
      await gesture.up();
      await wait(tester, const Duration(seconds: 8));
      expect(nudges, 0);
    });

    testWidgets('never under reduced motion', (tester) async {
      await pumpToday(tester, reduced: true);
      await wait(tester, const Duration(seconds: 8));
      expect(nudges, 0);
    });
  });

  group("the header Mobi's line never covers the greeting (22 Oct finding 22, round 3)", () {
    setUp(() {
      MobiRation.reset();
      HeaderMobi.resetGreeting();
    });
    tearDown(MobiRation.reset);

    /// Pumps Today at [width] dp and [scale] text scale, in either theme.
    Future<void> pumpAt(WidgetTester tester, double width, double scale, {Brightness brightness = Brightness.light}) =>
        pumpMockmob(
          tester,
          TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero),
          size: Size(width, 1900),
          textScale: scale,
          brightness: brightness,
          overrides: [auth],
        );

    testWidgets('nothing is said at first paint or in the first 3 s', (tester) async {
      await pumpToday(tester);
      await wait(tester, const Duration(seconds: 3));
      expect(find.byType(MobiBubble), findsNothing, reason: 'the 4 s idle rule decides when he speaks, not the first paint');
      expect(find.text('Good evening, Asha'), findsOneWidget);
    });

    testWidgets('after 4 s idle he says his line, the greeting stays, and the line goes after a while', (tester) async {
      await pumpToday(tester);
      await wait(tester, const Duration(seconds: 5));
      expect(find.byType(MobiBubble), findsOneWidget);
      expect(find.text('Good evening, Asha'), findsOneWidget);
      await wait(tester, const Duration(seconds: 8));
      expect(find.byType(MobiBubble), findsNothing);
    });

    for (final brightness in [Brightness.dark, Brightness.light]) {
      for (final width in [320.0, 360.0, 411.0]) {
        for (final scale in [1.0, 1.3]) {
          testWidgets('the line sits below the header text and never over it at $width dp, ${scale}x, ${brightness.name}',
              (tester) async {
            await pumpAt(tester, width, scale, brightness: brightness);
            await wait(tester, const Duration(seconds: 3));
            expect(find.byType(MobiBubble), findsNothing, reason: 'nothing at first paint, nothing before 4 s idle');
            await wait(tester, const Duration(seconds: 2));
            expect(find.byType(MobiBubble), findsOneWidget);
            final bubble = tester.getRect(find.byType(MobiBubble));
            final greeting = tester.getRect(find.text('Good evening, Asha'));
            final date = tester.getRect(find.text(buildToday(ashaInputs()).header.dateLine));
            final mobi = tester.getRect(find.byType(HeaderMobi));
            final week = tester.getRect(find.byType(WeekLedger));
            expect(bubble.overlaps(greeting), isFalse, reason: 'bubble $bubble vs greeting $greeting');
            expect(bubble.overlaps(date), isFalse, reason: 'bubble $bubble vs date $date');
            expect(bubble.overlaps(mobi), isFalse, reason: 'the bubble is below Mobi, not on him');
            expect(bubble.overlaps(week), isFalse, reason: 'the week steps down; the bubble never sits on it');
            expect(bubble.left, greaterThanOrEqualTo(0));
            expect(bubble.right, lessThanOrEqualTo(width));
            await wait(tester, const Duration(seconds: 8));
            expect(find.byType(MobiBubble), findsNothing);
          });
        }
      }
    }

    testWidgets('a touch before 4 s means he stays quiet, and the greeting is never dimmed', (tester) async {
      await pumpToday(tester);
      await wait(tester, const Duration(seconds: 2));
      final gesture = await tester.startGesture(const Offset(192, 1500));
      await gesture.up();
      await wait(tester, const Duration(seconds: 8));
      expect(find.byType(MobiBubble), findsNothing);
    });

    testWidgets('under reduced motion he never speaks on his own', (tester) async {
      await pumpToday(tester, reduced: true);
      await wait(tester, const Duration(seconds: 8));
      expect(find.byType(MobiBubble), findsNothing);
    });

    testWidgets('while the opening still covers the app (tickers muted) his clock does not run', (tester) async {
      var live = false;
      late StateSetter set;
      await pumpMockmob(
        tester,
        StatefulBuilder(builder: (context, setState) {
          set = setState;
          return TickerMode(
            enabled: live,
            child: TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero),
          );
        }),
        size: const Size(384, 1900),
        overrides: [auth],
      );
      await wait(tester, const Duration(seconds: 6));
      expect(find.byType(MobiBubble), findsNothing, reason: 'nothing is said out of sight');
      set(() => live = true);
      await tester.pump();
      await wait(tester, const Duration(seconds: 3));
      expect(find.byType(MobiBubble), findsNothing, reason: 'his 4 s start when the app is seen');
      await wait(tester, const Duration(seconds: 3));
      expect(find.byType(MobiBubble), findsOneWidget);
    });
  });

  group('the hero number (MOTION-08)', () {
    testWidgets('lands after the card has arrived, with one selection tick', (tester) async {
      final haptics = _CountingHaptics();
      await pumpToday(tester, haptics: haptics);
      expect(haptics.selections, 0, reason: 'at 640 ms the stage has landed (540 ms); the number lands at 660 ms');
      await wait(tester, const Duration(milliseconds: 300));
      expect(haptics.selections, 1);
      await wait(tester, const Duration(seconds: 2));
      expect(haptics.selections, 1, reason: 'after landing it never moves');
    });

    testWidgets('under reduced motion it is simply there: no roll, no tick', (tester) async {
      final haptics = _CountingHaptics();
      await pumpToday(tester, reduced: true, haptics: haptics);
      await wait(tester, const Duration(seconds: 2));
      expect(haptics.selections, 0);
    });
  });

  testWidgets('the resume hero draws its subject emblem without looking up a raster (ART-02)', (tester) async {
    Widget card(String? subject) => ResumeHeroCard(
          resume: ResumeHero(sessionId: 's1', title: 'Mock 8', answered: 12, total: 50, line: 'Ends at 9:40 PM.', subjectId: subject),
          onContinue: () {},
        );
    await pumpMockmob(tester, card('accountancy'), size: const Size(384, 700), disableAnimations: true);
    expect(find.byType(HeroArtView), findsOneWidget);
    expect(find.byType(SubjectEmblem), findsOneWidget);
    await pumpMockmob(tester, card(null), size: const Size(384, 700), disableAnimations: true);
    expect(find.byType(HeroArtView), findsNothing, reason: 'no subject, no prop');
  });

  for (final brightness in [Brightness.dark, Brightness.light]) {
    testWidgets('the card keeps its quiet key announced once and tappable, with no pinned bar copy, ${brightness.name}', (tester) async {
      await pumpMockmob(
        tester,
        PhoneFrame(child: TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero)),
        brightness: brightness,
        size: kTodaySize,
        disableAnimations: true,
        overrides: todayOverrides,
      );
      final handle = tester.ensureSemantics();
      await tester.pump();
      final alternative = TodayCopy.chooseSomethingElse;
      expect(announced(tester).where((l) => l == alternative), hasLength(1), reason: 'the capsule replaced the pinned bar: one key, not two');
      final quiet = find.text(alternative);
      expect(quiet, findsOneWidget);
      expect(quiet.hitTestable(), findsOneWidget, reason: 'nothing is pinned over the card any more, so its quiet key takes touches');
      await expectLater(tester, meetsGuideline(textContrastGuideline));
      handle.dispose();
    });
  }

  testWidgets('a piece keeps its state when the entrance lands and on later rebuilds', (tester) async {
    final controller = AnimationController(vsync: const TestVSync(), duration: todayEntranceDuration);
    addTearDown(controller.dispose);
    Widget page(String label) => Directionality(
          textDirection: TextDirection.ltr,
          child: TodayEntranceScope(
            progress: controller,
            child: TodayEnter(delay: Duration.zero, child: _Probe(label)),
          ),
        );
    await tester.pumpWidget(page('a'));
    final first = tester.state(find.byType(_Probe));
    controller.value = 0.3;
    await tester.pump();
    controller.value = 1;
    await tester.pump();
    expect(tester.state(find.byType(_Probe)), same(first), reason: 'landing drops the Opacity, not the child');
    await tester.pumpWidget(page('b'));
    expect(tester.state(find.byType(_Probe)), same(first), reason: 'a rebuild after the entrance keeps it too');
    expect(find.text('b'), findsOneWidget);
  });
}

class _Probe extends StatefulWidget {
  const _Probe(this.label);

  final String label;

  @override
  State<_Probe> createState() => _ProbeState();
}

class _ProbeState extends State<_Probe> {
  @override
  Widget build(BuildContext context) => Text(widget.label);
}
