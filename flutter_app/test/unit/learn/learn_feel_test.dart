// Concept checks with life (motion packet M4): answering inks the right answer with a drawn check
// and one soft click, a miss gets one gentle nudge and a short Mobi encouragement, a rated card
// flies off on a spring, and the pips fill on a spring. Reduced motion shows the end state, and
// nothing replays for a step reopened from a saved state.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/study.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/learn/copy.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/screens/run_screen.dart';
import 'package:mockmob/features/learn/widgets/answer_inputs.dart';
import 'package:mockmob/features/learn/widgets/feedback_mobi.dart';
import 'package:mockmob/features/learn/widgets/rating_keys.dart';
import 'package:mockmob/features/learn/widgets/run_pips.dart';
import 'package:mockmob/features/learn/widgets/step_swap.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;

import '../../golden/learn/golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/learn_fixtures.dart';

class _Haptics implements HapticDriver {
  int light = 0;
  int medium = 0;
  int selection = 0;

  int get total => light + medium + selection;

  @override
  Future<void> lightImpact() async => light++;

  @override
  Future<void> mediumImpact() async => medium++;

  @override
  Future<void> selectionClick() async => selection++;
}

class _ScriptedRun extends RunController {
  _ScriptedRun(super.runId, this.initial);

  final RunUiState initial;
  @override
  RunUiState build() => initial;

  void show(RunUiState next) => state = next;
}

RunUiState _ready(StudyRun r) => RunUiState(load: RunLoad.ready, run: r);


Map<String, dynamic> _fixture() =>
    jsonDecode(File('test/fixtures/learn_feel/feel.json').readAsStringSync()) as Map<String, dynamic>;

Iterable<double> _strokeProgress(WidgetTester tester) => tester
    .widgetList<CustomPaint>(find.byType(CustomPaint))
    .map((p) => p.painter)
    .whereType<MmStrokeDrawPainter>()
    .map((p) => p.progress.value);

double _shakeX(WidgetTester tester) {
  final t = tester.widget<Transform>(find.descendant(of: find.byType(MmShake), matching: find.byType(Transform)).first);
  return t.transform.getTranslation().x;
}

void main() {
  setUpAll(loadAppFonts);
  setUp(MobiRation.reset);

  group('the shared fixture (the website tests the same bytes)', () {
    test('the words and the numbers equal the fixture', () {
      final f = _fixture();
      final copy = f['copy'] as Map<String, dynamic>;
      expect(LearnCopy.missNudge, copy['miss']);
      expect(LearnCopy.skippedNudge, copy['skipped']);

      final ink = f['ink'] as Map<String, dynamic>;
      expect(AnswerInk.ring.inMilliseconds, ink['ringMs']);
      expect(AnswerInk.check.inMilliseconds, ink['checkMs']);
      expect(AnswerInk.lead.inMilliseconds, ink['leadMs']);
      expect(AnswerInk.checkAfter.inMilliseconds, ink['checkAfterMs']);
      expect(AnswerInk.panelCheck.inMilliseconds, ink['panelCheckMs']);

      final nudge = f['nudge'] as Map<String, dynamic>;
      expect(MmShake.amplitude, nudge['amplitude']);
      expect(MmShake.cycles, nudge['cycles']);
      expect(MmShake.duration.inMilliseconds, nudge['durationMs']);

      final swap = f['swap'] as Map<String, dynamic>;
      expect(StepSwap.arriveTravel, swap['arriveTravel']);
      expect(StepSwap.flyTravel, swap['flyTravel']);
      expect(StepSwap.flyLift, swap['flyLift']);
      expect(StepSwap.flyScale, swap['flyScale']);
      expect(StepSwap.flyGoneAt, swap['flyGoneAt']);

      final mobi = f['mobi'] as Map<String, dynamic>;
      expect(FeedbackMobi.actFor(right: true).name, mobi['rightAct']);
      expect(FeedbackMobi.actFor(right: false).name, mobi['missAct']);
      expect(MobiRation.glanceGap.inMilliseconds, mobi['gapMs']);
      expect(FeedbackMobi.slot, mobi['slot']);
    });

    test('no exclamation mark, em dash or middle dot in the new words', () {
      for (final line in [LearnCopy.missNudge, LearnCopy.skippedNudge]) {
        expect(line, isNot(contains('!')));
        expect(line, isNot(contains('—')));
        expect(line, isNot(contains('·')));
      }
    });
  });

  group('answering a concept check', () {
    final live = _ready(run(cursor: 1, revision: 2, item: choiceCard()));
    final right = _ready(
      run(
        cursor: 1,
        revision: 3,
        revealed: true,
        item: choiceCard(revealed: true, answer: 0),
        feedback: {'correct': true, 'answer': '3:2', 'chosen': '3:2', 'explanation': 'C takes the share in the old ratio.'},
      ),
    );
    final wrong = _ready(
      run(
        cursor: 1,
        revision: 3,
        revealed: true,
        item: choiceCard(revealed: true, answer: 0),
        feedback: {
          'correct': false,
          'answer': '3:2',
          'chosen': '1:1',
          'whyChosen': '1:1 would be right only if A and B gave up equal amounts.',
          'explanation': 'C takes the share in the old ratio.',
        },
      ),
    );

    late _ScriptedRun scripted;
    late _Haptics haptics;

    Future<void> open(
      WidgetTester tester,
      RunUiState start, {
      CelebrationMode mode = CelebrationMode.full,
      bool disableAnimations = false,
      double textScale = 1,
    }) async {
      haptics = _Haptics();
      await pumpMockmob(
        tester,
        const LearnRunScreen(runId: 'run-1'),
        brightness: Brightness.dark,
        wrapInScaffold: false,
        disableAnimations: disableAnimations,
        textScale: textScale,
        overrides: [
          ...learnOverrides(),
          runControllerProvider('run-1').overrideWith(() => scripted = _ScriptedRun('run-1', start)),
          celebrationModeProvider.overrideWithValue(mode),
          hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
        ],
      );
    }

    testWidgets('a right answer inks its outline and check, clicks once and shows Mobi correct', (tester) async {
      await open(tester, live);
      expect(haptics.total, 0);
      scripted.show(right);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      expect(haptics.light, 1, reason: 'one soft click, once the server has acknowledged the answer');
      expect(haptics.total, 1);
      // Just arrived: the outline and checks have started but are not finished.
      expect(_strokeProgress(tester).any((p) => p < 1), isTrue);
      expect(find.byType(MobiCharacter), findsOneWidget);
      // The right row says so in words as well as in ink.
      expect(find.text(LearnCopy.correct), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
      expect(_strokeProgress(tester).every((p) => p == 1), isTrue, reason: 'the finished marks stay drawn');
      expect(find.text(LearnCopy.missNudge), findsNothing, reason: 'a right answer needs no encouragement line');
    });

    testWidgets('a miss nudges the wrong row once, clicks nothing, then inks the right row', (tester) async {
      await open(tester, live);
      scripted.show(wrong);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      await tester.pump(const Duration(milliseconds: 40));
      expect(_shakeX(tester), isNot(0), reason: 'the wrong row moves a little');
      expect(haptics.total, 0, reason: 'nothing fires on a wrong answer');
      // The right row has not started inking: it waits for the nudge to finish.
      expect(_strokeProgress(tester).every((p) => p == 0), isTrue);
      expect(find.text(LearnCopy.missNudge), findsOneWidget);
      expect(find.byType(MobiCharacter), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
      expect(_shakeX(tester), 0, reason: 'it lands exactly where it started');
      expect(_strokeProgress(tester).every((p) => p == 1), isTrue);
      expect(haptics.total, 0);
    });

    testWidgets('Celebrations Quiet and Off keep the words and drop Mobi', (tester) async {
      for (final mode in [CelebrationMode.quiet, CelebrationMode.off]) {
        MobiRation.reset();
        await open(tester, live, mode: mode);
        scripted.show(wrong);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));
        expect(find.byType(MobiCharacter), findsNothing, reason: '$mode');
        expect(find.text(LearnCopy.missNudge), findsOneWidget, reason: '$mode keeps the line');
        await tester.pumpWidget(const SizedBox());
      }
    });

    testWidgets('large text keeps the line and drops Mobi', (tester) async {
      await open(tester, live, textScale: 2);
      scripted.show(wrong);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(MobiCharacter), findsNothing);
      expect(find.text(LearnCopy.missNudge), findsOneWidget);
    });

    testWidgets('Mobi reacts at most once every 2.5 seconds', (tester) async {
      var now = DateTime(2026, 10, 15, 18);
      MobiRation.now = () => now;
      // Another answer was reacted to a moment ago.
      expect(MobiRation.reactNow(FeedbackMobi.gate), isTrue);
      now = now.add(const Duration(milliseconds: 1200));
      await open(tester, live);
      scripted.show(right);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(MobiCharacter), findsNothing, reason: 'too soon after the last one');
      expect(find.text(LearnCopy.correct), findsOneWidget, reason: 'the panel itself is still there');
    });

    testWidgets('a step reopened from a saved state is simply there: no click, no Mobi, marks drawn', (tester) async {
      await open(tester, wrong);
      await tester.pump(const Duration(milliseconds: 16));
      expect(haptics.total, 0);
      expect(find.byType(MobiCharacter), findsNothing);
      expect(_strokeProgress(tester).every((p) => p == 1), isTrue);
      expect(_shakeX(tester), 0);
      expect(find.text(LearnCopy.missNudge), findsOneWidget, reason: 'the words are part of the result, not of the moment');
    });

    testWidgets('reduced motion shows the end state at once (the click and the words stay)', (tester) async {
      await open(tester, live, disableAnimations: true);
      scripted.show(right);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      expect(_strokeProgress(tester).every((p) => p == 1), isTrue);
      expect(haptics.light, 1, reason: 'the haptic has its own Touch feedback switch');
    });

    testWidgets('a skipped choice gets the skipped line and no nudge', (tester) async {
      final skipped = _ready(
        run(
          cursor: 1,
          revision: 3,
          revealed: true,
          item: choiceCard(revealed: true, answer: 0),
          feedback: {'correct': false, 'answer': '3:2', 'skipped': true, 'explanation': 'C takes the share in the old ratio.'},
        ),
      );
      await open(tester, live);
      scripted.show(skipped);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      await tester.pump(const Duration(milliseconds: 40));
      expect(find.text(LearnCopy.skippedNudge), findsOneWidget);
      expect(find.byType(MmShake), findsNothing, reason: 'no row was picked, so nothing is nudged');
      expect(haptics.total, 0);
    });

    testWidgets('a miss on a typed answer nudges the panel once', (tester) async {
      final typed = _ready(run(cursor: 4, revision: 8, item: textCard()));
      final missed = _ready(
        run(
          cursor: 4,
          revision: 9,
          revealed: true,
          item: textCard(),
          feedback: {'correct': false, 'answer': 'scrutinise', 'given': 'scrutnise', 'explanation': 'Look at it closely.'},
        ),
      );
      await open(tester, typed);
      scripted.show(missed);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      await tester.pump(const Duration(milliseconds: 40));
      expect(_shakeX(tester), isNot(0));
      await tester.pump(const Duration(seconds: 1));
      expect(_shakeX(tester), 0);
      expect(haptics.total, 0);
    });
  });

  group('rating a card', () {
    testWidgets('the tapped key inks volt and the others wait; at rest none is nudged', (tester) async {
      Future<void> pumpKeys(int? sending) => pumpMockmob(
            tester,
            Padding(padding: const EdgeInsets.all(16), child: RatingKeys(onRate: (_) {}, sending: sending)),
            brightness: Brightness.dark,
          );

      await pumpKeys(null);
      final rest = tester.widgetList<KeyButton>(find.byType(KeyButton)).toList();
      expect(rest, hasLength(4));
      expect(rest.every((k) => k.variant == KeyVariant.secondary), isTrue, reason: 'no rating is the volt key');
      expect(rest.every((k) => k.onPressed != null), isTrue);

      await pumpKeys(2);
      await tester.pump(const Duration(milliseconds: 400));
      final keys = tester.widgetList<KeyButton>(find.byType(KeyButton)).toList();
      final picked = keys.where((k) => k.variant == KeyVariant.primary).toList();
      expect(picked, hasLength(1));
      expect(picked.single.label, LearnCopy.hard);
      expect(picked.single.loading, isTrue);
      expect(keys.where((k) => k.variant == KeyVariant.secondary).every((k) => k.onPressed == null), isTrue);
    });

    test('a rated card flies 56 dp left, lifts, shrinks and is gone before its spring settles', () {
      expect(StepSwap.flyOffset(0), Offset.zero);
      expect(StepSwap.flyOffset(1), const Offset(-StepSwap.flyTravel, -StepSwap.flyLift));
      expect(StepSwap.flyScaleAt(1), StepSwap.flyScale);
      expect(StepSwap.flyOpacity(0), 1);
      expect(StepSwap.flyOpacity(StepSwap.flyGoneAt), 0);
      expect(StepSwap.flyOpacity(0.3), inExclusiveRange(0, 1));
    });

    test('an axis step holds until the new one is half there, never dimming the pair under the floor', () {
      var last = 1.0;
      for (var i = 0; i <= 20; i++) {
        final t = i / 20;
        final out = StepSwap.axisOutOpacity(t);
        expect(out, lessThanOrEqualTo(last + 1e-9), reason: 'it only ever fades');
        last = out;
        final incoming = Motion.glide.transform(t);
        expect(out + incoming, greaterThanOrEqualTo(MmOverlapSwitcher.floor - 1e-9), reason: 'the ground never flashes through at t=$t');
      }
      expect(StepSwap.axisOutOpacity(0), 1);
      expect(StepSwap.axisOutDrift(1), closeTo(-StepSwap.arriveTravel * Motion.recedeShare, 1e-9));
    });
  });

  group('the step swap', () {
    // Pumped once; every swap after that is driven by the notifier, so the clock starts at the
    // swap (pumpMockmob itself plays out 640 ms of animation).
    late ValueNotifier<(String, bool, String)> step;

    Future<void> open(WidgetTester tester, {bool reduced = false}) async {
      _Probe.inits.clear();
      step = ValueNotifier(('a', true, 'A'));
      await pumpMockmob(
        tester,
        SizedBox(
          width: 300,
          height: 200,
          child: ValueListenableBuilder<(String, bool, String)>(
            valueListenable: step,
            builder: (context, s, _) => StepSwap(stepKey: s.$1, rated: s.$2, child: _Probe(s.$3)),
          ),
        ),
        brightness: Brightness.dark,
        disableAnimations: reduced,
      );
    }

    testWidgets('the rated card flies off to the left while the next arrives from the right, then it is gone', (tester) async {
      await open(tester);
      final home = tester.getTopLeft(find.text('A'));
      step.value = ('b', false, 'B');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      expect(find.text('A'), findsOneWidget);
      expect(find.text('B'), findsOneWidget);
      expect(tester.getTopLeft(find.text('A')).dx, lessThan(home.dx), reason: 'the card leaves to the left');
      expect(tester.getTopLeft(find.text('B')).dx, greaterThan(home.dx), reason: 'the next one comes from the right');
      expect(_Probe.inits['A'], 1, reason: 'the card that leaves is the same one, not a rebuilt copy');
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('A'), findsNothing);
      expect(tester.getTopLeft(find.text('B')).dx, home.dx);
    });

    testWidgets('a step that is not rated steps off the axis instead of flying', (tester) async {
      await open(tester);
      step.value = ('a2', false, 'A2');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      final home = tester.getTopLeft(find.text('A2'));
      step.value = ('b', false, 'B');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      final drift = home.dx - tester.getTopLeft(find.text('A2')).dx;
      expect(drift, greaterThan(0));
      expect(drift, lessThanOrEqualTo(StepSwap.arriveTravel * Motion.recedeShare + 0.01), reason: 'a fifth of the arrival, not a flight');
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('A2'), findsNothing);
    });

    testWidgets('the leaving step takes no touches and is hidden from screen readers', (tester) async {
      await open(tester);
      step.value = ('b', false, 'B');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 40));
      final leaving = find.ancestor(of: find.text('A'), matching: find.byType(IgnorePointer));
      expect(tester.widgetList<IgnorePointer>(leaving).any((w) => w.ignoring), isTrue);
      final hidden = find.ancestor(of: find.text('A'), matching: find.byType(ExcludeSemantics));
      expect(tester.widgetList<ExcludeSemantics>(hidden).any((w) => w.excluding), isTrue);
      final arriving = find.ancestor(of: find.text('B'), matching: find.byType(IgnorePointer));
      expect(tester.widgetList<IgnorePointer>(arriving).any((w) => w.ignoring), isFalse);
      await tester.pump(const Duration(milliseconds: 600));
    });

    testWidgets('reduced motion: the old step is gone at once and the new one only fades in', (tester) async {
      await open(tester, reduced: true);
      final home = tester.getTopLeft(find.text('A'));
      step.value = ('b', false, 'B');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 20));
      expect(find.text('A'), findsNothing);
      expect(tester.getTopLeft(find.text('B')).dx, home.dx, reason: 'nothing travels');
      await tester.pump(const Duration(milliseconds: 200));
    });
  });

  group('the pips', () {
    late ValueNotifier<int> done;

    double fill(WidgetTester tester, int index) {
      final fills = tester
          .widgetList<Transform>(find.descendant(of: find.byType(RunPips), matching: find.byType(Transform)))
          .where((t) => t.alignment == Alignment.centerLeft)
          .toList();
      return index < fills.length ? fills[index].transform.storage[0] : 0;
    }

    Future<void> open(WidgetTester tester, {bool reduced = false}) async {
      done = ValueNotifier(1);
      await pumpMockmob(
        tester,
        Padding(
          padding: const EdgeInsets.all(16),
          child: ValueListenableBuilder<int>(valueListenable: done, builder: (context, d, _) => RunPips(total: 4, done: d)),
        ),
        brightness: Brightness.dark,
        disableAnimations: reduced,
      );
    }

    testWidgets('a pip fills on a spring: it moves, never jumps, and ends exactly full', (tester) async {
      await open(tester);
      expect(fill(tester, 0), 1, reason: 'a run reopened part-way shows its done pips already full');
      expect(fill(tester, 1), 0);
      done.value = 2;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      final early = fill(tester, 1);
      expect(early, inExclusiveRange(0, 1));
      await tester.pump(const Duration(milliseconds: 60));
      final later = fill(tester, 1);
      expect(later, greaterThan(early));
      await tester.pump(const Duration(seconds: 2));
      expect(fill(tester, 1), 1);
    });

    testWidgets('reduced motion fills at once', (tester) async {
      await open(tester, reduced: true);
      done.value = 2;
      await tester.pump();
      expect(fill(tester, 1), 1);
    });
  });
}

/// A child that counts how many times it was built from scratch, by label.
class _Probe extends StatefulWidget {
  const _Probe(this.label);

  final String label;

  static final Map<String, int> inits = {};

  @override
  State<_Probe> createState() => _ProbeState();
}

class _ProbeState extends State<_Probe> {
  @override
  void initState() {
    super.initState();
    _Probe.inits.update(widget.label, (n) => n + 1, ifAbsent: () => 1);
  }

  @override
  Widget build(BuildContext context) => Align(alignment: Alignment.topLeft, child: Text(widget.label));
}
