import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/full/full_sections.dart' show whereSection;
import 'package:mockmob/features/result/full/lab_ledger_section.dart';
import 'package:mockmob/features/result/widgets/breakdown_section.dart' show BreakdownSection;

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/lab_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);
  setUp(LabLedgerSection.debugResetSeen);

  Future<List<int>> pump(
    WidgetTester tester,
    MistakeLab lab, {
    bool reduced = false,
    VoidCallback? onSeeChanges,
    String attemptId = 'a7',
    double height = 1600,
  }) async {
    final opened = <int>[];
    await pumpLabHost(
      tester,
      LabLedgerSection(attemptId: attemptId, lab: lab, onOpenQuestion: opened.add, onSeeChanges: onSeeChanges),
      reduced: reduced,
      size: Size(360, height),
    );
    return opened;
  }

  /// Whether [text] is drawn at full strength (no fading ancestor below 1).
  bool atRest(WidgetTester tester, String text) => tester
      .widgetList<Opacity>(find.ancestor(of: find.text(text), matching: find.byType(Opacity)))
      .every((o) => o.opacity >= 1);

  testWidgets('ready: the heading, the headline, every group with its line, the re-mark, the cohort and the fine lines', (tester) async {
    final lab = labOf('ready');
    await pump(tester, lab, onSeeChanges: () {});
    await tester.pumpAndSettle();
    expect(find.text('Mistake Lab'), findsOneWidget);
    expect(find.text(lab.heading), findsOneWidget);
    expect(find.text(lab.headline!.text), findsOneWidget);
    for (final g in lab.groups) {
      expect(find.text(g.label), findsOneWidget, reason: g.id);
      expect(find.text(g.line), findsOneWidget, reason: g.id);
    }
    // Only the headline's group starts open, with its one thing to do and its questions.
    expect(find.text('Open every question once before you go deep on any.'), findsOneWidget);
    expect(find.text('Change an answer only when you can point to the line that proves it wrong.'), findsNothing);
    for (final n in [45, 46, 47, 48, 49, 50]) {
      expect(find.text('Q$n'), findsOneWidget);
    }
    expect(find.text(lab.remark!.text), findsOneWidget);
    expect(find.text(lab.remark!.fine!), findsOneWidget);
    expect(find.text('See every change'), findsOneWidget);
    expect(find.text(lab.cohort!.line!), findsOneWidget);
    for (final line in [...lab.fine, ...lab.cohort!.fine]) {
      expect(find.text(line), findsOneWidget);
    }
  });

  testWidgets("the bar's semantics label is the server's bar label", (tester) async {
    final handle = tester.ensureSemantics();
    final lab = labOf('ready');
    await pump(tester, lab);
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel(lab.barLabel!), findsOneWidget);
    expect(find.bySemanticsLabel('Never opened, 30 marks on 6 questions'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('a Q chip opens that answer; a closed row opens on a tap and shows its own chips', (tester) async {
    final opened = await pump(tester, labOf('ready'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Q47'));
    expect(opened, [47]);
    await tester.tap(find.text('Right, then changed'));
    await tester.pumpAndSettle();
    expect(find.text('Change an answer only when you can point to the line that proves it wrong.'), findsOneWidget);
    await tester.tap(find.text('Q31'));
    expect(opened, [47, 31]);
    // The cohort line's questions are chips too.
    await tester.ensureVisible(find.text('Q42'));
    await tester.tap(find.text('Q42'));
    expect(opened, [47, 31, 42]);
    // Tapped again, the row closes.
    await tester.ensureVisible(find.text('Right, then changed'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Right, then changed'));
    await tester.pumpAndSettle();
    expect(find.text('Change an answer only when you can point to the line that proves it wrong.'), findsNothing);
  });

  testWidgets('a tap on the bar opens the row of the segment under the finger', (tester) async {
    await pump(tester, labOf('ready'));
    await tester.pumpAndSettle();
    final bar = find.bySemanticsLabel(labOf('ready').barLabel!);
    // The first segment (12 of 112 marks) starts at the bar's left edge.
    await tester.tapAt(tester.getTopLeft(bar) + const Offset(4, 16));
    await tester.pumpAndSettle();
    expect(find.text('Change an answer only when you can point to the line that proves it wrong.'), findsOneWidget);
  });

  testWidgets('more than 9 questions in a group: the first 8, then "Show {k} more"', (tester) async {
    final json = labContract('ready');
    final groups = [for (final g in json['groups'] as List) Map<String, dynamic>.from(g as Map)];
    groups[1]['numbers'] = [for (var n = 39; n <= 50; n++) n];
    final opened = await pump(tester, MistakeLab.tryParse({...json, 'groups': groups})!);
    await tester.pumpAndSettle();
    expect(find.text('Q46'), findsOneWidget);
    expect(find.text('Q47'), findsNothing);
    expect(find.text('Show 4 more'), findsOneWidget);
    await tester.tap(find.text('Show 4 more'));
    await tester.pumpAndSettle();
    expect(find.text('Show 4 more'), findsNothing);
    await tester.tap(find.text('Q50'));
    expect(opened, [50]);
  });

  testWidgets('the split plays once: the rows arrive after their segments, and a second visit is at rest', (tester) async {
    final lab = labOf('ready');
    await pump(tester, lab);
    // In view on the first frame: the split has started and the last rows have not arrived.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(atRest(tester, 'Opened, left blank'), isFalse);
    await tester.pump(LabLedgerSection.splitLength(lab.groups.length));
    expect(atRest(tester, 'Opened, left blank'), isTrue);
    await tester.pumpAndSettle();

    // The same attempt again in this app run: at rest at once.
    await tester.pumpWidget(const SizedBox());
    await pump(tester, lab);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 16));
    expect(atRest(tester, 'Opened, left blank'), isTrue);
  });

  testWidgets('reduced motion: the final state at once', (tester) async {
    await pump(tester, labOf('ready'), reduced: true);
    await tester.pump();
    for (final g in labOf('ready').groups) {
      expect(atRest(tester, g.label), isTrue, reason: g.id);
    }
    // Opening a row still works, with no lift.
    await tester.tap(find.text('Wrong in under 20 seconds'));
    await tester.pump();
    expect(find.text('Read the whole question before you look at the options.'), findsOneWidget);
  });

  testWidgets('"See every change" calls back, and is not there without Time and decisions', (tester) async {
    var seen = 0;
    await pump(tester, labOf('ready'), onSeeChanges: () => seen++);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('See every change'));
    await tester.tap(find.text('See every change'));
    expect(seen, 1);

    await tester.pumpWidget(const SizedBox());
    await pump(tester, labOf('ready'), attemptId: 'b2');
    await tester.pumpAndSettle();
    expect(find.text('See every change'), findsNothing);
  });

  testWidgets('basic: wrong and blank with the fine line, no headline, re-mark or cohort', (tester) async {
    final lab = labOf('basic');
    await pump(tester, lab, onSeeChanges: () {});
    await tester.pumpAndSettle();
    expect(find.text(lab.heading), findsOneWidget);
    expect(find.text('Wrong answers'), findsOneWidget);
    expect(find.text('Blanks'), findsOneWidget);
    expect(find.text(lab.fine.single), findsOneWidget);
    expect(find.text('See every change'), findsNothing);
  });

  group('whereSection picks the ledger only for a ready or basic lab', () {
    Future<void> pumpWhere(WidgetTester tester, MistakeLab? lab) async {
      await pumpLabHost(
        tester,
        Builder(builder: (context) => whereSection(context, mock7(), lab: lab, onOpenQuestion: (_) {})),
        size: const Size(360, 1600),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('ready', (tester) async {
      await pumpWhere(tester, labOf('ready'));
      expect(find.byType(LabLedgerSection), findsOneWidget);
      expect(find.byType(BreakdownSection), findsNothing);
    });

    testWidgets('basic', (tester) async {
      await pumpWhere(tester, labOf('basic'));
      expect(find.byType(LabLedgerSection), findsOneWidget);
    });

    testWidgets("none, or no lab: today's breakdown under the Lab's name", (tester) async {
      await pumpWhere(tester, labOf('none'));
      expect(find.byType(LabLedgerSection), findsNothing);
      expect(find.byType(BreakdownSection), findsOneWidget);
      expect(find.text('Mistake Lab'), findsOneWidget);
      await pumpWhere(tester, null);
      expect(find.byType(LabLedgerSection), findsNothing);
      expect(find.byType(BreakdownSection), findsOneWidget);
    });
  });

  test('the bar keeps every segment at least 6 dp and fills the width', () {
    final p = LedgerBarPainter(
      marks: const [100, 1, 5],
      counts: const [20, 1, 1],
      styles: const [],
      neutral: Colors.grey,
      tick: Colors.black,
      split: const AlwaysStoppedAnimation(1),
      focus: const AlwaysStoppedAnimation(0),
      focusIndex: null,
      lift: true,
      segments: 3,
    );
    final w = p.widths(300, (_) => LedgerBarPainter.gap);
    expect(w.every((x) => x >= LedgerBarPainter.minWidth - 1e-9), isTrue);
    expect(w.fold<double>(0, (s, x) => s + x) + 2 * LedgerBarPainter.gap, closeTo(300, 1e-6));
    expect(p.indexAt(1, 300), 0);
    expect(p.indexAt(299, 300), 2);
  });
}
