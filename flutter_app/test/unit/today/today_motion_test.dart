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
import 'package:mockmob/core/widgets/count_up.dart' show MmNumberMemory;
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/header_mobi.dart';
import 'package:mockmob/features/today/widgets/hero_stage.dart';
import 'package:mockmob/features/today/widgets/resume_hero.dart';
import 'package:mockmob/features/today/widgets/today_entrance.dart';

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

  // TODAY-1017 4.6: no Mobi in Today's header, so nothing nudges from it and no line can cover the
  // greeting. Mobi appears only in the move card's art box or beside the week at a real moment.
  testWidgets('Today has no header Mobi: no nudge, and the greeting stays clear', (tester) async {
    await pumpMockmob(
      tester,
      PhoneFrame(child: TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero)),
      size: kTodaySize,
      disableAnimations: true,
      overrides: todayOverrides,
    );
    await tester.pump(const Duration(seconds: 5));
    expect(find.byType(HeaderMobi), findsNothing);
    expect(find.text('Good evening, Asha'), findsOneWidget);
  });

  group('the hero number (MOTION-08)', () {
    // The hero remembers the count it showed (a rebuilt hero rolls on from it); each case here
    // is a fresh app run.
    setUp(MmNumberMemory.clear);

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
      final alternative = TodayCopy.somethingElse;
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
