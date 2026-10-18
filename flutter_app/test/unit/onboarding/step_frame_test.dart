import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/widgets/step_frame.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// D40, D43, D44, D48 (owner, 18 Oct): the shared step frame on the four phone sizes.
void main() {
  setUpAll(loadAppFonts);
  setUp(MobiRation.reset);
  tearDown(MobiRation.reset);

  const statusBar = 28.0;
  const gestureBar = 20.0;

  Future<void> pumpStep(WidgetTester tester, OnboardingAnswers answers, Size size) async {
    tester.view.padding = const FakeViewPadding(top: statusBar * 2, bottom: gestureBar * 2);
    addTearDown(tester.view.resetPadding);
    await pumpMockmob(
      tester,
      const OnboardingFlow(skipColdOpen: true, startInDeck: true),
      size: size,
      disableAnimations: true,
      overrides: onboardingOverrides(answers: answers),
    );
    await tester.pumpAndSettle();
  }

  RenderBalancedBox balanced(WidgetTester tester) => tester.renderObject<RenderBalancedBox>(find.byType(BalancedBox));
  RenderGuidedGroup group(WidgetTester tester) => tester.renderObject<RenderGuidedGroup>(find.byType(GuidedGroup));

  const sizes = [Size(360, 800), Size(390, 844), Size(412, 915), Size(360, 640)];

  for (final size in sizes) {
    final tag = '${size.width.round()} by ${size.height.round()}';

    testWidgets('$tag: Mobi stands clear of the status bar, sized to the phone, never on the title', (tester) async {
      await pumpStep(tester, const OnboardingAnswers(step: Steps.stage), size);
      final mobi = find.byType(MobiCharacter);
      expect(mobi, findsOneWidget, reason: 'one Mobi, in the group');
      final top = tester.getTopLeft(mobi).dy;
      expect(top, greaterThanOrEqualTo(statusBar + 24), reason: 'at least 24 dp under the status bar');
      final s = group(tester).mobiSize;
      expect(s, inInclusiveRange(88, 168));
      expect(tester.getSize(mobi).height, moreOrLessEquals(s, epsilon: 0.5));
      final title = find.text(OnboardingCopy.stageTitle);
      expect(tester.getTopLeft(title).dy, greaterThanOrEqualTo(tester.getBottomLeft(mobi).dy), reason: 'the title starts under Mobi');
      // The action row: 16 dp above the gesture bar.
      final key = find.widgetWithText(KeyButton, OnboardingCopy.next);
      expect(tester.getBottomLeft(key).dy, moreOrLessEquals(size.height - gestureBar - StepFrame.footGap, epsilon: 0.5));
      expect(tester.takeException(), isNull);
    });

    testWidgets('$tag: the group is balanced in the free height, or scrolls when it cannot fit', (tester) async {
      await pumpStep(tester, studentUpTo(Steps.worry), size);
      final box = balanced(tester);
      final child = box.child!.size.height;
      final scroll = tester.state<ScrollableState>(find.descendant(of: find.byType(StepFrame), matching: find.byType(Scrollable)).first);
      final viewport = scroll.position.viewportDimension;
      if (child + RenderBalancedBox.fitGap <= viewport) {
        final spare = box.size.height - child;
        final want = (spare * StepFrame.topShare).clamp(0.0, spare - RenderBalancedBox.fitGap);
        expect(box.top, moreOrLessEquals(want, epsilon: 1), reason: '45% of the spare room above (8 dp kept below)');
        expect(scroll.position.maxScrollExtent, 0);
      } else {
        expect(box.top, 0);
        expect(scroll.position.maxScrollExtent, greaterThan(0), reason: 'a short phone scrolls instead of clipping');
        expect(box.size.height - child, StepFrame.fade + 8, reason: 'the last answer clears the fade at the end');
      }
      expect(tester.takeException(), isNull);
    });

    testWidgets('$tag: the plan takes a bigger Mobi, 120 to 200 dp', (tester) async {
      await pumpStep(tester, studentUpTo(Steps.rhythm, step: Steps.plan), size);
      expect(group(tester).mobiSize, inInclusiveRange(120, 200));
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('on a 360 by 800 phone the first step fits: its four answers and the key, no scroll', (tester) async {
    await pumpStep(tester, const OnboardingAnswers(step: Steps.stage), const Size(360, 800));
    final scroll = tester.state<ScrollableState>(find.descendant(of: find.byType(StepFrame), matching: find.byType(Scrollable)).first);
    expect(scroll.position.maxScrollExtent, 0);
  });

  testWidgets('the save step: Mobi beside the title, so the sheet and the bank line fit on a 390 by 844 phone', (tester) async {
    await pumpStep(tester, studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult), const Size(390, 844));
    final scroll = tester.state<ScrollableState>(find.descendant(of: find.byType(StepFrame), matching: find.byType(Scrollable)).first);
    expect(scroll.position.maxScrollExtent, 0);
    final mobi = find.byType(MobiCharacter);
    final title = find.text(OnboardingCopy.saveTitle);
    expect(tester.getTopLeft(mobi).dx, greaterThan(tester.getTopRight(title).dx), reason: 'at the end of the title row');
    expect(find.text(OnboardingCopy.bankLine(8197)), findsOneWidget);
  });

  testWidgets('with room to spare Mobi is 18% of the free height', (tester) async {
    await pumpStep(tester, studentUpTo(Steps.worry, step: Steps.question), const Size(412, 915));
    final free = balanced(tester).size.height;
    expect(group(tester).mobiSize, moreOrLessEquals((free * 0.18).clamp(88, 168), epsilon: 0.5));
  });

  test('Mobi sizing: clamp(18%, 88, 168); the plan 30%, 120 to 200; fit gives back room down to the floor', () {
    const s = MobiSizing();
    expect(s.sizeFor(300), 88);
    expect(s.sizeFor(600), moreOrLessEquals(108));
    expect(s.sizeFor(1200), 168);
    expect(s.sizeFor(600, rest: 480, gap: 12), moreOrLessEquals(108), reason: 'fits as is');
    expect(s.sizeFor(600, rest: 495, gap: 12), moreOrLessEquals(93));
    expect(s.sizeFor(600, rest: 560, gap: 12), 88, reason: 'never below the floor');
    expect(MobiSizing.plan.sizeFor(600), moreOrLessEquals(180));
    expect(MobiSizing.plan.sizeFor(900), 200);
    expect(MobiSizing.plan.sizeFor(300), 120);
  });

  testWidgets('the bubble line goes up a type step from 760 dp', (tester) async {
    final c = MobiController();
    addTearDown(c.dispose);
    for (final (h, large) in [(800.0, true), (700.0, false)]) {
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => GuideHeader(controller: c, size: 100, large: MediaQuery.sizeOf(context).height >= StepFrame.largeBubbleFrom),
        ),
        size: Size(360, h),
        disableAnimations: true,
      );
      c.say('Sealed. It is yours.');
      await tester.pump();
      final bubble = tester.widget<MobiBubble>(find.byType(MobiBubble));
      expect(bubble.large, large);
      expect(bubble.maxWidth, greaterThan(200), reason: 'the bubble takes the rest of the row');
      c.hush();
      await tester.pump();
    }
  });
}
