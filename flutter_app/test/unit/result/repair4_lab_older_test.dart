import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart' show Scrollable, Semantics, Size;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/lab_ledger_section.dart' show LabLedgerSection;
import 'package:mockmob/features/result/full/lab_older_note.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';
import 'support/lab_fixtures.dart';

/// Repair v4, the honest older-paper Lab: `lab.older {reason, line, action}` from the website's
/// `olderPaper` (data/mistake_lab.js), and the marked-for-review SWOT item (data/mock_swot.js).
/// The fixtures are the website's: contract_basic_v1.json (reason no_clock) and contract_none_v1.json
/// (reason before_capture) carry `older`; contract_ready_v1.json, a paper with a whole record, has none.
Map<String, dynamic> _marked() => jsonDecode(File('test/fixtures/swot_marked_review_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// The note's one key.
final noteButton = find.descendant(of: find.byType(LabOlderNote), matching: find.byType(KeyButton));

void main() {
  setUpAll(loadAppFonts);

  group('lab.older: the model', () {
    test('basic: no clock record, with the line and one timed mock of the subject', () {
      final lab = labOf('basic');
      final older = lab.older!;
      expect(older.reason, 'no_clock');
      expect(older.line, 'This paper has no clock record, so its time, answer changes and replay are not shown.');
      expect(older.action!.label, 'Take a timed mock to see your full Lab');
      expect(older.action!.subject, 'accountancy');
      expect(older.action!.mode, 'full');
      expect(lab.showsLedger, isTrue, reason: 'the ledger still draws: older adds a line, it takes nothing away');
    });

    test('none: a paper from before the capture says what it cannot show, and its action reads "another"', () {
      final lab = labOf('none');
      expect(lab.state, MistakeLab.none);
      expect(lab.older!.reason, 'before_capture');
      expect(lab.older!.line, "This paper's record has no time away, marks for review or how the paper ended, so those are not shown.");
      expect(lab.older!.action!.label, 'Take another timed mock to see your full Lab');
    });

    test('a paper with a whole record has no older, and neither does an older server', () {
      expect(labOf('ready').older, isNull);
      final j = labContract('ready')..remove('older');
      expect(MistakeLab.tryParse(j)!.older, isNull);
    });

    test('parts read on their own: no line is no note, no usable action leaves the line alone, unknown fields are ignored', () {
      final base = labContract('basic');
      expect(MistakeLab.tryParse({...base, 'older': {'reason': 'no_clock', 'line': '  '}})!.older, isNull);
      expect(MistakeLab.tryParse({...base, 'older': 'text'})!.older, isNull);
      final lineOnly = MistakeLab.tryParse({
        ...base,
        'older': {'reason': 'short', 'line': 'Too short to read.', 'action': {'subject': 'accountancy'}, 'future': 1},
      })!.older!;
      expect(lineOnly.line, 'Too short to read.');
      expect(lineOnly.action, isNull);
      // Nothing else in the lab is touched by a malformed older.
      expect(MistakeLab.tryParse({...base, 'older': 7})!.gap, 28);
    });

    test('every reason the server can send reads as it is, with its own words', () {
      for (final reason in ['no_clock', 'short', 'unreadable', 'not_matched', 'before_capture']) {
        final older = MistakeLab.tryParse({
          ...labContract('basic'),
          'older': {'reason': reason, 'line': 'Line for $reason.', 'action': {'label': 'Go', 'subject': null, 'mode': 'full'}},
        })!.older!;
        expect(older.reason, reason);
        expect(older.action!.subject, isNull, reason: 'a paper with no subject keeps the mock without one');
      }
    });
  });

  group('the older note', () {
    testWidgets('the line and one action, which opens a full mock of the subject through setup', (tester) async {
      final opened = <String>[];
      await pumpLabHost(tester, LabOlderNote(older: labOf('basic').older!, onAction: opened.add));
      expect(find.text('This paper has no clock record, so its time, answer changes and replay are not shown.'), findsOneWidget);
      expect(noteButton, findsOneWidget);
      await tester.tap(noteButton);
      await tester.pump();
      // The setup screen shows the cost before anything starts: nothing is started or charged here.
      expect(opened, ['/practice/setup/full?subject=accountancy']);
    });

    test('the action link is built from its subject and mode, with the public subject id', () {
      expect(labOlderHref(const LabOlderAction(label: 'x', subject: 'accountancy')), '/dashboard?subject=accountancy&mode=full');
      expect(labOlderHref(const LabOlderAction(label: 'x', subject: 'gat')), '/dashboard?subject=general_test&mode=full');
      expect(labOlderHref(const LabOlderAction(label: 'x')), '/dashboard?mode=full');
    });

    testWidgets('a line with no action shows the line alone, and the button is a 48 dp target', (tester) async {
      await pumpLabHost(tester, const LabOlderNote(older: LabOlder(reason: 'short', line: 'Too short to read.')));
      expect(find.text('Too short to read.'), findsOneWidget);
      expect(find.byType(LabOlderNote), findsOneWidget);
      await pumpLabHost(tester, LabOlderNote(older: labOf('basic').older!));
      final button = find.ancestor(of: noteButton, matching: find.byType(Semantics)).first;
      expect(tester.getSize(button).height, greaterThanOrEqualTo(48));
    });
  });

  group('on the full result', () {
    Map<String, dynamic> withLab(String name, {String? remove}) {
      final lab = labContract(name);
      if (remove != null) lab.remove(remove);
      return {...attemptJson(), 'lab': lab};
    }

    Future<GoRouter> pumpResult(WidgetTester tester, Map<String, dynamic> body, {Size size = const Size(390, 853)}) async {
      final d = detail(attemptBody: body);
      final router = await pumpResultRoute(
        tester,
        openFolds: true,
        location: '/result/a7',
        size: size,
        overrides: resultOverrides(attemptId: 'a7', data: RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: d)),
      );
      await tester.pump(const Duration(milliseconds: 300));
      return router;
    }

    setUp(LabLedgerSection.debugResetSeen);

    testWidgets('an older paper shows its one line under the ledger and one action that opens a timed mock setup', (tester) async {
      await pumpResult(tester, withLab('basic'));
      await tester.pumpAndSettle();
      final line = find.text('This paper has no clock record, so its time, answer changes and replay are not shown.');
      await tester.scrollUntilVisible(line, 300, scrollable: find.byType(Scrollable).first);
      expect(line, findsOneWidget);
      // The fine line the ledger already had sits above it: the note comes last in the Lab.
      final fine = find.textContaining('The split shows wrong and blank only.');
      expect(tester.getTopLeft(fine).dy < tester.getTopLeft(line).dy, isTrue);
      final action = noteButton;
      await tester.scrollUntilVisible(action, 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(action);
      await tester.pumpAndSettle();
      // The route's stub says where it opened.
      expect(find.text('AT /practice/setup/full?subject=accountancy'), findsOneWidget);
    });

    testWidgets('a paper from before the capture with nothing missed still says what its record cannot show', (tester) async {
      await pumpResult(tester, withLab('none'));
      await tester.pumpAndSettle();
      final line = find.text("This paper's record has no time away, marks for review or how the paper ended, so those are not shown.");
      await tester.scrollUntilVisible(line, 300, scrollable: find.byType(Scrollable).first);
      expect(line, findsOneWidget);
      // The last two words are joined by a no-break space, so a long label never leaves one word alone.
      expect(find.text('Take another timed mock to see your full Lab'), findsWidgets);
    });

    testWidgets('a paper with a whole record, or an older server, shows no such line', (tester) async {
      await pumpResult(tester, withLab('ready'));
      await tester.pumpAndSettle();
      expect(find.textContaining('record has no time away'), findsNothing);
      expect(find.textContaining('has no clock record'), findsNothing);
      expect(find.textContaining('to see your full Lab'), findsNothing);
    });
  });

  group('marked for review in the SWOT', () {
    test('the three reads of the website parse as ordinary items: title, detail and the question numbers', () {
      final blank = Swot.fromJson((_marked()['blank'] as Map)['swot'] as Map<String, dynamic>);
      final item = blank.quadrants.firstWhere((q) => q.id == SwotQuadrant.opportunity).items.single;
      expect(item.kind, 'marked_review');
      expect(item.title, 'Marked for review, left blank');
      expect(item.detail, startsWith('You marked 6 of 50 questions for review and answered 4 of them: 3 right, 1 wrong. 2 stayed blank: 10 marks not earned.'));
      expect(item.questions, [5, 6]);
      expect(item.planId, 'p1');
      final row = blank.plan.single;
      expect(row.label, 'Practise 20, timed');
      expect(row.reason, '2 of the 6 questions you marked for review were left blank.');
      expect(row.practice.count, 20);
      final strong = Swot.fromJson((_marked()['strength'] as Map)['swot'] as Map<String, dynamic>);
      expect(strong.quadrants.firstWhere((q) => q.id == SwotQuadrant.strength).items.single.title, 'Marked for review, then answered');
      final weak = Swot.fromJson((_marked()['weakness'] as Map)['swot'] as Map<String, dynamic>);
      expect(weak.quadrants.firstWhere((q) => q.id == SwotQuadrant.weakness).items.single.title, 'Marked for review, then wrong');
    });
  });
}
