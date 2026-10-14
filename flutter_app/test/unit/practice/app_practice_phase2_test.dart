// Phase 2, the Practice packet: the resident Mobi's quiet clock, the ticket's tear, the length
// dial's follow-the-finger drag and its semantic actions, the resume card's painted sheet, the
// card's float and sheen, the subject pick's squash, the chapter chips and the cap shake, the
// result's long press and the receipt's chapter. Pure rules are tested as functions; the moves
// are tested by what is on screen after the time they take.
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/suggestion.dart';
import 'package:mockmob/features/practice/practice_start_screen.dart' show StartStage;
import 'package:mockmob/features/practice/widgets/card_motion.dart';
import 'package:mockmob/features/practice/widgets/chapter_picker.dart';
import 'package:mockmob/features/practice/widgets/composer_ticket.dart';
import 'package:mockmob/features/practice/widgets/length_dial.dart';
import 'package:mockmob/features/practice/widgets/numbered_sheet.dart';
import 'package:mockmob/features/practice/widgets/practice_mobi.dart';
import 'package:mockmob/features/practice/widgets/practice_motion.dart';
import 'package:mockmob/features/practice/widgets/resume_sheet.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;
import '../core_data/support/fixtures.dart';

class _Recorder implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');

  @override
  Future<void> selectionClick() async => calls.add('selection');
}

/// One theme object for the whole file: a new (equal) one on every pump would make the app's own
/// theme animation run and hide the motion these tests look for.
ThemeData? _theme;

Future<_Recorder> _pump(WidgetTester tester, Widget child, {bool reduceMotion = false}) async {
  tester.view.physicalSize = const Size(384, 853) * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final haptics = _Recorder();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: _theme ??= buildTheme(Brightness.dark),
          builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduceMotion), child: child!),
          home: Scaffold(
            body: SafeArea(
              child: Padding(padding: const EdgeInsets.all(16), child: child),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  return haptics;
}

class _Dial extends StatefulWidget {
  const _Dial();

  @override
  State<_Dial> createState() => _DialState();
}

class _DialState extends State<_Dial> {
  int count = 10;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text('count:$count', key: const ValueKey('count')),
      LengthDial(count: count, counts: const [5, 10, 15, 20], semanticsLabel: 'Questions', onChanged: (c) => setState(() => count = c)),
    ],
  );
}

/// Performs a TalkBack [action] on the dial's semantics node.
void _act(WidgetTester tester, SemanticsAction action) {
  final node = tester.getSemantics(find.byType(LengthDial));
  tester.binding.pipelineOwner.semanticsOwner!.performAction(node.id, action);
}

void main() {
  setUpAll(loadAppFonts);

  group('the reactions are pure where they can be', () {
    test('the squash goes down, rebounds and rests at 1', () {
      expect(PracticeSquash.scaleAt(0), const Offset(1, 1));
      final down = PracticeSquash.scaleAt(0.17);
      expect(down.dx, closeTo(1.08, 0.001));
      expect(down.dy, closeTo(0.9, 0.001));
      final end = PracticeSquash.scaleAt(1);
      expect(end.dx, closeTo(1, 0.01));
      expect(end.dy, closeTo(1, 0.01));
    });

    test('the shake starts and ends still and stays within 4 dp', () {
      expect(PracticeShake.offsetAt(0), 0);
      expect(PracticeShake.offsetAt(1).abs(), lessThan(0.001));
      for (var i = 0; i <= 20; i++) {
        expect(PracticeShake.offsetAt(i / 20).abs(), lessThanOrEqualTo(4));
      }
    });

    test('the emblem floats 3 dp each way on a 6 s sine', () {
      expect(EmblemFloat.period, const Duration(seconds: 6));
      expect(EmblemFloat.offsetAt(0), closeTo(0, 1e-9));
      expect(EmblemFloat.offsetAt(0.25), closeTo(3, 1e-9));
      expect(EmblemFloat.offsetAt(0.75), closeTo(-3, 1e-9));
    });

    test('the sheen band crosses the key once, from before its left edge to past its right', () {
      expect(StartSheen.bandAt(0), closeTo(-0.3, 1e-9));
      expect(StartSheen.bandAt(1), closeTo(1.3, 1e-9));
    });

    test('the resume sheet fits its bubbles to the width and never takes more than three rows', () {
      expect(ResumeSheet.gridFor(0, 300), (0, 0));
      expect(ResumeSheet.gridFor(10, 300), (10, 1));
      final (cols, rows) = ResumeSheet.gridFor(50, 300);
      expect(rows, lessThanOrEqualTo(ResumeSheet.maxRows));
      expect(cols * rows, greaterThanOrEqualTo(50));
      expect(ResumeSheet.shownAt(500, 100), lessThan(500));
      expect(ResumeSheet.startOf(0, 5), 0);
      expect(ResumeSheet.startOf(4, 5), closeTo(0.7, 1e-9));
      expect(ResumeSheet.startOf(0, 1), 0);
    });

    test('the three start stages are in the order the work happens, with their own words', () {
      expect(StartStage.values.take(3).map((s) => s.index), [0, 1, 2]);
      expect(StartStage.labels, ['Checking the cost', 'Drawing your questions', 'Opening your paper']);
      expect(StartStage.done.index, 3);
    });

    test('a receipt names the chapter of a By-chapter run, and only then', () {
      final at = DateTime(2026, 10, 12, 23, 51);
      expect(PracticeCopy.recorded(at), 'Practice finished. Recorded at 11:51 PM.');
      expect(PracticeCopy.recorded(at, chapter: 'Goodwill'), 'Chapter practice finished, Goodwill. Recorded at 11:51 PM.');
      expect(PracticeCopy.recorded(at, chapter: 'Goodwill.'), 'Chapter practice finished, Goodwill. Recorded at 11:51 PM.');
      expect(PracticeCopy.finished(at, chapter: 'Goodwill'), PracticeCopy.recorded(at, chapter: 'Goodwill'));
    });

    test('Mobi says what a long-pressed bubble was', () {
      expect(PracticeCopy.cellSays(7, QuestionCell.wrong), 'Question 7: wrong');
      expect(PracticeCopy.cellSays(1, QuestionCell.right), 'Question 1: correct');
      expect(PracticeCopy.cellSays(12, QuestionCell.blank), 'Question 12: not attempted');
    });
  });

  group('from your record', () {
    int ms(Duration ago) => DateTime(2026, 10, 12, 20).subtract(ago).millisecondsSinceEpoch;

    test('up to three chapters, the costliest first, from the latest paper in the subject only', () {
      final older = attemptOf(id: 'a', completedAt: ms(const Duration(days: 3)), questions: chapterOf('Cash flow', wrong: 5));
      final latest = attemptOf(
        id: 'b',
        completedAt: ms(const Duration(hours: 5)),
        questions: [
          ...chapterOf('Admission of a partner', right: 1, wrong: 3),
          ...chapterOf('Goodwill', right: 2, wrong: 1),
          ...chapterOf('Issue of shares', right: 1, wrong: 1, blank: 1),
          ...chapterOf('Ratios', right: 1, wrong: 2),
          ...chapterOf('Fine chapter', right: 4),
        ],
      );
      final other = attemptOf(id: 'c', subject: 'economics', completedAt: ms(const Duration(hours: 1)), questions: chapterOf('Demand', wrong: 4));
      final chips = recordChaptersFor(attempts: [older, latest, other], subjectId: 'accountancy');
      expect(chips.length, 3);
      expect(chips.map((c) => c.chapter), ['Admission of a partner', 'Ratios', 'Issue of shares']);
      expect(chips.first.marksLost, 3 * 6);
      expect(chips.map((c) => c.chapter), isNot(contains('Cash flow')));
      expect(chips.map((c) => c.chapter), isNot(contains('Fine chapter')));
    });

    test('with no paper, no loss or nothing to name, there is nothing to show', () {
      expect(recordChaptersFor(attempts: null, subjectId: 'accountancy'), isEmpty);
      expect(recordChaptersFor(attempts: const [], subjectId: 'accountancy'), isEmpty);
      final clean = attemptOf(id: 'a', completedAt: 1000, questions: chapterOf('Goodwill', right: 5));
      expect(recordChaptersFor(attempts: [clean], subjectId: 'accountancy'), isEmpty);
      final thin = attemptOf(id: 'b', completedAt: 1000, questions: [('Goodwill', V.wrong), ('Shares', V.wrong)]);
      expect(recordChaptersFor(attempts: [thin], subjectId: 'accountancy'), isEmpty);
    });
  });

  group('the length dial', () {
    testWidgets('a drag across the track follows the finger, ticks each stop, and a detent is firmer at the ends', (tester) async {
      final haptics = await _pump(tester, const _Dial());
      await tester.pump(const Duration(milliseconds: 600));
      final rect = tester.getRect(find.byType(LengthDial));
      final y = rect.center.dy;
      // From the 10 stop to the far right: 15 (a tick), then 20 (the end detent).
      final gesture = await tester.startGesture(Offset(rect.left + rect.width * 0.375, y));
      await gesture.moveBy(const Offset(70, 0));
      await tester.pump(const Duration(milliseconds: 16));
      await gesture.moveTo(Offset(rect.right - 6, y));
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.text('count:20'), findsOneWidget);
      await gesture.up();
      await tester.pumpAndSettle();
      expect(find.text('count:20'), findsOneWidget);
      expect(haptics.calls, contains('selection'));
      expect(haptics.calls.last, 'light');
      expect(tester.takeException(), isNull);
    });

    testWidgets('a flick left carries to the first stop and springs there', (tester) async {
      final haptics = await _pump(tester, const _Dial());
      final rect = tester.getRect(find.byType(LengthDial));
      await tester.flingFrom(Offset(rect.left + rect.width * 0.375, rect.center.dy), const Offset(-300, 0), 900);
      await tester.pumpAndSettle();
      expect(find.text('count:5'), findsOneWidget);
      expect(haptics.calls, contains('light'));
      expect(tester.takeException(), isNull);
    });

    testWidgets('TalkBack can increase and decrease it one stop at a time, and hears the value', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const _Dial());
      await tester.pump(const Duration(milliseconds: 600));
      final node = tester.getSemantics(find.byType(LengthDial));
      expect(node.value, '10 questions');
      expect(node.increasedValue, '15 questions');
      expect(node.decreasedValue, '5 questions');
      expect(node.getSemanticsData().hasAction(SemanticsAction.increase), isTrue);
      expect(node.getSemanticsData().hasAction(SemanticsAction.decrease), isTrue);
      _act(tester, SemanticsAction.increase);
      await tester.pumpAndSettle();
      expect(find.text('count:15'), findsOneWidget);
      _act(tester, SemanticsAction.decrease);
      await tester.pumpAndSettle();
      _act(tester, SemanticsAction.decrease);
      await tester.pumpAndSettle();
      expect(find.text('count:5'), findsOneWidget);
      // At the first stop there is nothing below.
      expect(tester.getSemantics(find.byType(LengthDial)).getSemanticsData().hasAction(SemanticsAction.decrease), isFalse);
      handle.dispose();
    });

    testWidgets('under reduced motion the thumb still follows the finger and lands at once', (tester) async {
      await _pump(tester, const _Dial(), reduceMotion: true);
      final rect = tester.getRect(find.byType(LengthDial));
      await tester.dragFrom(Offset(rect.left + rect.width * 0.375, rect.center.dy), const Offset(200, 0));
      await tester.pump();
      expect(find.text('count:20'), findsOneWidget);
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('the ticket tears only when told to', () {
    Widget ticket(TicketTear tear) => ComposerTicket(
      subjectId: 'accountancy',
      eyebrow: 'Quick practice',
      subject: 'Accountancy',
      count: 10,
      semanticsLabel: 'Quick practice, Accountancy',
      tear: tear,
    );

    testWidgets('at rest one ticket; lifted and torn, the stub is a second copy that goes; back to rest, one ticket again', (tester) async {
      await _pump(tester, ticket(TicketTear.rest));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('10'), findsOneWidget);

      await _pump(tester, ticket(TicketTear.lifted));
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('10'), findsNWidgets(2));

      await _pump(tester, ticket(TicketTear.torn));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('10'), findsNWidgets(2));
      // Mid-tear the stub copy is on its way out (fading), not yet gone.
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.takeException(), isNull);

      await _pump(tester, ticket(TicketTear.rest));
      await tester.pumpAndSettle();
      expect(find.text('10'), findsOneWidget);
    });

    testWidgets('a start that fails drops the stub back: lifted, then rest, settles on one ticket', (tester) async {
      await _pump(tester, ticket(TicketTear.rest));
      await _pump(tester, ticket(TicketTear.lifted));
      await tester.pump(const Duration(milliseconds: 220));
      await _pump(tester, ticket(TicketTear.rest));
      await tester.pumpAndSettle();
      expect(find.text('10'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('under reduced motion the torn stub is simply gone, with no movement to wait for', (tester) async {
      await _pump(tester, ticket(TicketTear.rest), reduceMotion: true);
      await _pump(tester, ticket(TicketTear.torn), reduceMotion: true);
      await tester.pump();
      expect(tester.hasRunningAnimations, isFalse);
      expect(tester.takeException(), isNull);
    });
  });

  group('the resident Mobi', () {
    testWidgets('nudges once after 4 s with no touch, never again, and a touch restarts the quiet', (tester) async {
      var nudges = 0;
      PracticeMobi.debugOnNudge = () => nudges++;
      addTearDown(() => PracticeMobi.debugOnNudge = null);
      final mobi = MobiController();
      addTearDown(mobi.dispose);
      await _pump(tester, Center(child: PracticeMobi(controller: mobi, entrance: MobiAct.idle, loading: false)));
      await tester.pump(const Duration(seconds: 3));
      expect(nudges, 0);
      // A touch anywhere on the screen: the 4 s start again.
      final g = await tester.startGesture(const Offset(10, 10));
      await g.up();
      await tester.pump(const Duration(seconds: 3, milliseconds: 500));
      expect(nudges, 0);
      await tester.pump(const Duration(milliseconds: 700));
      expect(nudges, 1);
      await tester.pump(const Duration(seconds: 30));
      expect(nudges, 1);
    });

    testWidgets('does not think for a quote that answers at once, and does not nudge while it waits on one', (tester) async {
      var nudges = 0;
      PracticeMobi.debugOnNudge = () => nudges++;
      addTearDown(() => PracticeMobi.debugOnNudge = null);
      final mobi = MobiController();
      addTearDown(mobi.dispose);
      Widget app(bool loading) => Center(child: PracticeMobi(controller: mobi, entrance: MobiAct.idle, loading: loading));
      await _pump(tester, app(true));
      await tester.pump(const Duration(seconds: 5));
      expect(nudges, 0, reason: 'waiting on a quote, he does not point at Start');
      await _pump(tester, app(false));
      await tester.pump(const Duration(seconds: 4, milliseconds: 100));
      expect(nudges, 1);
      expect(tester.takeException(), isNull);
    });

    testWidgets('under reduced motion he holds a still pose and never nudges', (tester) async {
      var nudges = 0;
      PracticeMobi.debugOnNudge = () => nudges++;
      addTearDown(() => PracticeMobi.debugOnNudge = null);
      final mobi = MobiController();
      addTearDown(mobi.dispose);
      await _pump(tester, Center(child: PracticeMobi(controller: mobi, entrance: MobiAct.idle, loading: false)), reduceMotion: true);
      await tester.pump(const Duration(seconds: 10));
      expect(nudges, 0);
    });
  });

  group('the Start sheen', () {
    testWidgets('sweeps once after the quiet and not again', (tester) async {
      await _pump(
        tester,
        const StartSheen(after: Duration(milliseconds: 200), child: SizedBox(width: 200, height: 48)),
      );
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pump(const Duration(milliseconds: 250));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpAndSettle();
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pump(const Duration(seconds: 5));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a touch before it cancels it for good', (tester) async {
      await _pump(
        tester,
        const StartSheen(after: Duration(milliseconds: 400), child: SizedBox(width: 200, height: 48)),
      );
      await tester.pump(const Duration(milliseconds: 200));
      final g = await tester.startGesture(const Offset(5, 5));
      await g.up();
      await tester.pump(const Duration(seconds: 2));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('an offline (disabled) key and reduced motion get none', (tester) async {
      await _pump(tester, const StartSheen(enabled: false, after: Duration(milliseconds: 50), child: SizedBox(width: 200, height: 48)));
      await tester.pump(const Duration(milliseconds: 200));
      expect(tester.hasRunningAnimations, isFalse);
      await _pump(tester, const StartSheen(after: Duration(milliseconds: 50), child: SizedBox(width: 200, height: 48)), reduceMotion: true);
      await tester.pump(const Duration(milliseconds: 200));
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('the resume sheet', () {
    testWidgets('inks the answered bubbles in order once the answers are known, then holds still', (tester) async {
      Widget sheet(List<bool>? a) => SizedBox(width: 300, child: ResumeSheet(total: 20, answered: a));
      await _pump(tester, sheet(null));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.hasRunningAnimations, isFalse, reason: 'unknown answers: empty rings, nothing runs');
      await _pump(tester, sheet([for (var i = 0; i < 20; i++) i < 7]));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpAndSettle();
      expect(tester.hasRunningAnimations, isFalse);
      expect(tester.takeException(), isNull);
    });

    testWidgets('under reduced motion the final sheet shows at once', (tester) async {
      await _pump(tester, SizedBox(width: 300, child: ResumeSheet(total: 20, answered: [for (var i = 0; i < 20; i++) i < 7])), reduceMotion: true);
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('the subject pick and the cap', () {
    testWidgets('the squash plays on a new trigger and ends at rest', (tester) async {
      Widget squash(int t) => PracticeSquash(trigger: t, glint: Colors.amber, child: const SizedBox(width: 60, height: 60));
      await _pump(tester, squash(0));
      expect(tester.hasRunningAnimations, isFalse);
      await _pump(tester, squash(1));
      await tester.pump(const Duration(milliseconds: 90));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpAndSettle();
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('the squash and the shake stand still under reduced motion', (tester) async {
      await _pump(tester, const PracticeSquash(trigger: 0, glint: Colors.amber, child: SizedBox(width: 60, height: 60)), reduceMotion: true);
      await _pump(tester, const PracticeSquash(trigger: 1, glint: Colors.amber, child: SizedBox(width: 60, height: 60)), reduceMotion: true);
      await tester.pump(const Duration(milliseconds: 90));
      expect(tester.hasRunningAnimations, isFalse);
      await _pump(tester, const PracticeShake(trigger: 0, child: Text('limit')), reduceMotion: true);
      await _pump(tester, const PracticeShake(trigger: 1, child: Text('limit')), reduceMotion: true);
      await tester.pump(const Duration(milliseconds: 90));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('the shake runs for 320 ms on a new trigger', (tester) async {
      await _pump(tester, const PracticeShake(trigger: 0, child: Text('limit')));
      await _pump(tester, const PracticeShake(trigger: 1, child: Text('limit')));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('the chosen chapters as chips', () {
    Widget chips(List<String> chosen, List<String> removed) => ChosenChapterChips(chapters: chosen, onRemove: removed.add);

    testWidgets('each chosen chapter is a chip; a new one scales in; a removed one fades out before it leaves', (tester) async {
      final removed = <String>[];
      await _pump(tester, chips(['Goodwill'], removed));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Goodwill'), findsOneWidget);

      await _pump(tester, chips(['Goodwill', 'Ratios'], removed));
      await tester.pump(const Duration(milliseconds: 60));
      expect(find.text('Ratios'), findsOneWidget);
      await tester.pumpAndSettle();

      await _pump(tester, chips(['Goodwill'], removed));
      await tester.pump(const Duration(milliseconds: 60));
      expect(find.text('Ratios'), findsOneWidget, reason: 'still fading out');
      await tester.pumpAndSettle();
      expect(find.text('Ratios'), findsNothing);
      expect(find.text('Goodwill'), findsOneWidget);
    });

    testWidgets('a tap on a chip asks for that chapter to be removed', (tester) async {
      final removed = <String>[];
      await _pump(tester, chips(['Goodwill', 'Ratios'], removed));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ratios'));
      await tester.pump();
      expect(removed, ['Ratios']);
    });

    testWidgets('under reduced motion a removed chip is gone at once', (tester) async {
      final removed = <String>[];
      await _pump(tester, chips(['Goodwill', 'Ratios'], removed), reduceMotion: true);
      await _pump(tester, chips(['Goodwill'], removed), reduceMotion: true);
      await tester.pump();
      await tester.pump();
      expect(find.text('Ratios'), findsNothing);
    });
  });

  group('the sheet on the result', () {
    testWidgets('a long press on a bubble reports which one', (tester) async {
      final pressed = <int>[];
      final cells = [QuestionCell.right, QuestionCell.wrong, QuestionCell.blank, QuestionCell.right];
      await _pump(tester, NumberedSheet(cells: cells, onCellLongPress: pressed.add));
      final box = tester.getRect(find.byType(NumberedSheet));
      final g = NumberedSheet.geometry(cells.length, box.width);
      final second = Offset(box.left + g.left + 1 * (g.cell + g.gap) + g.cell / 2, box.top + g.cell / 2);
      await tester.longPressAt(second);
      expect(pressed, [1]);
    });
  });
}
