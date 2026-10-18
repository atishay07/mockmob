import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/choices_copy.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subject_sets.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/widgets/subject_row.dart';

import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/steps/save_step.dart';
import 'package:mockmob/features/onboarding/widgets/choice_tile.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';
import 'package:mockmob/features/onboarding/widgets/swipe_preview.dart';
import 'package:flutter/rendering.dart';
import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// The v15 taste pass on onboarding (owner, 18 Oct 7:40 pm, D89-D90; OWNER-TASTE-PROFILE.md):
/// each behaviour the Opus taste critics asked for, locked.
Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 400));
  }
}

/// The flow at a step on a phone of [size] dp, signed out.
Future<ProviderContainer> _flowAt(
  WidgetTester tester,
  OnboardingAnswers answers, {
  Size size = const Size(360, 800),
  double textScale = 1,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: onboardingOverrides(answers: answers),
    child: DefaultAssetBundle(
      bundle: FileAssetBundle(),
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)), child: child!),
        home: const OnboardingFlow(skipColdOpen: true, startInDeck: true),
      ),
    ),
  ));
  await _settle(tester);
  return ProviderScope.containerOf(tester.element(find.byType(OnboardingFlow)));
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await _settle(tester);
}

OnboardingAnswers _answers(ProviderContainer c) => c.read(onboardingAnswersProvider).value!;

OnboardingAnswers _notSure(String step) => studentUpTo(Steps.stage, step: step).copyWith(courseUndecided: true).mark(Steps.course);

/// Counts the haptics a widget asks for.
class _Ticks implements HapticDriver {
  int selection = 0;
  int light = 0;

  @override
  Future<void> lightImpact() async => light++;

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async => selection++;
}

void main() {
  setUpAll(loadAppFonts);

  group('Subjects: a set tap leads to the rating', () {
    testWidgets('the rated rows slide into view, the other sets fold, and Mobi asks for honesty', (tester) async {
      final c = await _flowAt(tester, _notSure(Steps.subjects), size: const Size(412, 915));
      await _tap(tester, find.text(SubjectSets.commerce.title));
      expect(_answers(c).subjects.toSet(), SubjectSets.commerce.subjects.toSet());
      expect(find.text(ChoicesCopy.otherSets), findsOneWidget, reason: 'the two other sets fold into one quiet row');
      expect(find.text(SubjectSets.commerceMaths.title), findsNothing);
      expect(find.text(OnboardingCopy.mobiRateNow, findRichText: true), findsOneWidget, reason: 'Mobi asks for the rating');
      // The first rated row is on screen, above the key.
      final first = find.byType(SubjectRow).first;
      final keyTop = tester.getTopLeft(find.text(OnboardingCopy.next)).dy;
      expect(tester.getRect(first).top, lessThan(keyTop));
      expect(find.text('Shaky'), findsWidgets);
      // The fold opens again with a tap.
      await _tap(tester, find.text(ChoicesCopy.otherSets));
      expect(find.text(SubjectSets.commerceMaths.title), findsOneWidget);
      expect(find.text(ChoicesCopy.otherSets), findsNothing);
      // Rating stays optional: the key is live.
      expect(_answers(c).confidence, isEmpty);
      expect(tester.takeException(), isNull);
    });
  });

  group('Save: the sign-in keys never look disabled', () {
    testWidgets('before the age, Google is live, a tap asks the age; the age answers are 52 dp tiles with no dot', (tester) async {
      final c = await _flowAt(tester, studentUpTo(Steps.plan, step: Steps.save), size: const Size(412, 915));
      expect(_answers(c).age, isNull);
      final google = find.widgetWithText(KeyButton, OnboardingCopy.continueWithGoogle);
      expect(tester.widget<KeyButton>(google).onPressed, isNotNull);
      final email = find.widgetWithText(KeyButton, OnboardingCopy.useEmailCode);
      expect(tester.widget<KeyButton>(email).onPressed, isNotNull);
      final pills = find.byType(ChoicePills<AgeAnswer>);
      expect(find.descendant(of: pills, matching: find.byType(SelectBubble)), findsNothing, reason: 'answers, not radio rows');
      final yes = find.ancestor(of: find.text(AgeAnswer.adult.label), matching: find.byType(AnimatedContainer)).first;
      expect(tester.getSize(yes).height, 52);
      await tester.tap(google);
      await _settle(tester);
      expect(_answers(c).age, isNull);
      expect(find.byType(SaveStep), findsOneWidget, reason: 'still on the save step: the age comes first');
      await _tap(tester, find.text(AgeAnswer.adult.label));
      expect(_answers(c).age, AgeAnswer.adult);
      expect(tester.takeException(), isNull);
    });
  });

  group('After sign-in: a preview of the swipe deck before Today (D90)', () {
    Future<_Ticks> pumpPreview(WidgetTester tester, {bool reduced = false}) async {
      final ticks = _Ticks();
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: ticks))],
        child: MaterialApp(
          theme: buildTheme(Brightness.dark),
          builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: child!),
          home: const Scaffold(body: Padding(padding: EdgeInsets.all(20), child: SwipePreviewCard())),
        ),
      ));
      return ticks;
    }

    double cardX(WidgetTester tester) =>
        tester.getTopLeft(find.text(OnboardingCopy.swipePreviewTitle)).dx;

    testWidgets('on first show it nudges right, then left, and comes home; no haptic for a demo', (tester) async {
      final ticks = await pumpPreview(tester);
      final home = cardX(tester);
      var most = home, least = home;
      int? mostAt, leastAt;
      for (var t = 0; t < 180; t++) {
        await tester.pump(const Duration(milliseconds: 16));
        final x = cardX(tester);
        if (x > most) (most, mostAt) = (x, t);
        if (x < least) (least, leastAt) = (x, t);
      }
      expect(most, greaterThan(home + 18), reason: 'about 24 dp right');
      expect(least, lessThan(home - 18), reason: 'about 24 dp left');
      expect(mostAt!, lessThan(leastAt!), reason: 'right first, then left');
      await tester.pumpAndSettle();
      expect(cardX(tester), moreOrLessEquals(home, epsilon: 0.5));
      expect(ticks.selection, 0);
      expect(find.text(OnboardingCopy.swipePreviewCaption), findsOneWidget);
    });

    testWidgets('a drag past the deck threshold ticks once; letting go springs it home', (tester) async {
      final ticks = await pumpPreview(tester, reduced: true);
      final home = cardX(tester);
      final g = await tester.startGesture(tester.getCenter(find.byType(SwipePreviewCard)) - const Offset(0, 20));
      await g.moveBy(const Offset(20, 0));
      await g.moveBy(const Offset(60, 0));
      await tester.pump();
      expect(ticks.selection, 0, reason: '80 dp of 320 is under 30%');
      await g.moveBy(const Offset(40, 0));
      await tester.pump();
      expect(ticks.selection, 1, reason: 'the commit threshold, as on Today');
      await g.up();
      await tester.pumpAndSettle();
      expect(cardX(tester), moreOrLessEquals(home, epsilon: 0.5), reason: 'a preview never commits');
    });

    testWidgets('the sheet shows it once per install', (tester) async {
      final prefs = AppPrefs(MemoryPrefsStore());
      Future<void> open() async {
        await pumpMockmob(
          tester,
          const AfterSignInSheet(),
          size: const Size(412, 915),
          disableAnimations: true,
          overrides: [
            ...onboardingOverrides(
              answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.minor),
            ).where((o) => !identical(o.origin, appPrefsProvider)),
            appPrefsProvider.overrideWithValue(prefs),
          ],
        );
        await _settle(tester);
      }

      await open();
      expect(find.byType(SwipePreviewCard), findsOneWidget);
      expect(await prefs.swipePreviewSeen(), isTrue);
      await tester.pumpWidget(const SizedBox());
      await open();
      expect(find.byType(SwipePreviewCard), findsNothing, reason: 'Today teaches from here on');
    });
  });

  group('Marks: a pick never grows its tile', () {
    testWidgets('the place line is always laid out, so the row below stays put', (tester) async {
      final start = studentUpTo(Steps.subjects, step: Steps.worry).copyWith(worries: const []);
      await _flowAt(tester, start, size: const Size(412, 915));
      Rect tileOf(Worry w) => tester.getRect(find.ancestor(of: find.text(w.option), matching: find.byType(ChoiceTile)).first);
      final before = tileOf(Worry.knewIt);
      final below = tileOf(Worry.numericals).top;
      await _tap(tester, find.text(Worry.knewIt.option));
      expect(find.text('First'), findsOneWidget);
      expect(tileOf(Worry.knewIt).height, before.height, reason: 'no 24 dp jump on a pick');
      expect(tileOf(Worry.numericals).top, below, reason: 'the next row never moves');
    });
  });

  group('Stage: short titles, the tick clear of them', () {
    for (final scale in const [1.0, 1.3]) {
      testWidgets('the chosen tick never covers its title; titles stay short at ${scale}x', (tester) async {
        await _flowAt(tester, studentUpTo(Steps.stage), textScale: scale);
        final title = tester.getRect(find.text(Stage.classTwelve.option));
        final tile = find.ancestor(of: find.text(Stage.classTwelve.option), matching: find.byType(ChoiceTile)).first;
        final tick = tester.getRect(find.descendant(of: tile, matching: find.byType(Bubble)).first);
        expect(title.overlaps(tick), isFalse, reason: 'the tick sits beside the title, never on it');
        final line = tester.getSize(find.text(Stage.notSure.option)).height / scale;
        expect(title.height / scale, lessThanOrEqualTo(line * 2.2), reason: 'at most two lines, never four');
        expect(find.text(OnboardingCopy.stageWindowProbably), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });

  testWidgets('Stage at 1.3x: the weeks line is whole, above the tiles', (tester) async {
    await _flowAt(tester, studentUpTo(Steps.stage), textScale: 1.3);
    final line = find.text(OnboardingCopy.weeksUnit(2027));
    expect(line, findsOneWidget);
    final para = tester.renderObject<RenderParagraph>(line);
    expect(para.didExceedMaxLines, isFalse);
    final tileTop = tester.getRect(find.ancestor(of: find.text(Stage.classTwelve.option), matching: find.byType(ChoiceTile)).first).top;
    expect(tester.getRect(line).bottom, lessThanOrEqualTo(tileTop), reason: 'never cut mid-word under the tiles');
    expect(tester.takeException(), isNull);
  });

  testWidgets('The strip counts the step the student is on, not the answers', (tester) async {
    await _flowAt(tester, studentUpTo(Steps.course, step: Steps.subjects).copyWith(subjects: const []));
    expect(find.text('3 of 7'), findsOneWidget, reason: 'the ringed third bubble');
    expect(find.text('2 of 7'), findsNothing);
  });

  testWidgets('Pace: the live readout is the hero under the title and answers the controls', (tester) async {
    await _flowAt(tester, studentUpTo(Steps.question, step: Steps.rhythm), size: const Size(412, 915));
    final hours = find.textContaining('before May');
    expect(hours, findsOneWidget);
    final keyTop = tester.getTopLeft(find.text(OnboardingCopy.next)).dy;
    final title = tester.getRect(find.text(OnboardingCopy.rhythmTitle));
    final line = tester.getRect(hours);
    expect(line.top, greaterThan(title.bottom), reason: 'right under the title');
    expect(line.bottom, lessThan(keyTop), reason: 'in view while the slider is dragged');
    expect(line.bottom, lessThan(tester.getTopLeft(find.text(OnboardingCopy.minutesLabel)).dy), reason: 'above the controls');
    final before = tester.widget<Text>(hours).data;
    await _tap(tester, find.bySemanticsLabel(OnboardingCopy.minutesSpoken(30)));
    expect(tester.widget<Text>(find.textContaining('before May')).data, isNot(before), reason: 'it moves with the minutes');
  });
}
