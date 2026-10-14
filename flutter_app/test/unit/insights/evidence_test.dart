import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/evidence.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/subject_names.dart';
import 'package:mockmob/features/insights/data/trend.dart';
import 'package:mockmob/features/insights/widgets/ask_messages.dart';
import 'package:mockmob/features/insights/widgets/insights_bits.dart';
import 'package:mockmob/features/insights/widgets/record_sections.dart';
import 'package:mockmob/features/insights/widgets/trend_chart.dart';

import '../../helpers/golden_harness.dart';
import '../core_data/support/fixtures.dart';
import 'support/insights_fixtures.dart';

void main() {
  final now = DateTime.utc(2026, 10, 13, 14, 30);

  group('the sessions behind each claim', () {
    test('the chapter finding rests on the sessions with that chapter, newest first', () {
      final ev = RecordEvidence(trendAttempts(), now: now);
      final v = rich();
      final chapter = v.findings.firstWhere((f) => f.id == 'chapter');
      expect(ev.forFinding(chapter, v).map((a) => a.id), ['a2', 'a1']);
    });

    test('changed answers, timing, blanks and the last 14 days each have their own sessions', () {
      final ev = RecordEvidence(trendAttempts(), now: now);
      expect(ev.changes.map((a) => a.id), ['a2', 'a1']);
      expect(ev.pace.map((a) => a.id), ['a3', 'a2', 'a1']);
      expect(ev.withBlank, hasLength(5));
      expect(ev.lastTwoWeeks, hasLength(5));
      expect(RecordEvidence(trendAttempts(), now: now.add(const Duration(days: 30))).lastTwoWeeks, isEmpty);
    });

    test('a finding the phone cannot back with a session has no evidence (and is hidden)', () {
      final ev = RecordEvidence(trendAttempts(), now: now);
      const unknown = Finding(id: 'something_new', kind: 'info', headline: 'h', detail: 'd');
      expect(ev.forFinding(unknown, rich()), isEmpty);
      final thinRecord = thin();
      expect(ev.forFinding(thinRecord.findings.single, thinRecord), isEmpty);
      expect(RecordEvidence(thinAttempts(), now: now).forFinding(thinRecord.findings.single, thinRecord).single.id, 't1');
    });

    test('evidence is drawn from the 60 most recent sessions, as the server record is', () {
      final many = [
        for (var i = 0; i < 70; i++) attemptOf(id: 'x$i', completedAt: 1791028800000 + i * 1000, questions: chapterOf('C', right: 1)),
      ];
      final ev = RecordEvidence(many, now: now);
      expect(ev.ledger, hasLength(60));
      expect(ev.ledger.first.id, 'x69');
    });
  });

  group('subject marks', () {
    test('known subjects and languages have art; anything else gets initials', () {
      expect(isKnownSubject('business'), isTrue);
      expect(isKnownSubject('accountancy'), isTrue);
      expect(isLanguageSubject('hindi'), isTrue);
      expect(isKnownSubject('legal_studies'), isFalse);
      expect(isLanguageSubject('legal_studies'), isFalse);
    });
  });

  group('trend dots', () {
    testWidgets('the first and last sessions are dated, and a tapped dot opens a note with Show me', (tester) async {
      final series = trendSeries(trendAttempts());
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: TrendSection(series: series)),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.text('3 Oct'), findsOneWidget);
      expect(find.text('11 Oct'), findsOneWidget);
      expect(find.text('Show me'), findsNothing);
      final chart = find.byType(CustomPaint).last;
      final box = tester.getRect(chart);
      await tester.tapAt(Offset(box.right - 10, box.center.dy));
      await tester.pump();
      expect(find.text('Show me'), findsOneWidget);
      expect(find.text('39 of 50 marks'), findsOneWidget);
      expect(find.text('10 questions'), findsOneWidget);
    });
  });

  group('trend note placement', () {
    TrendSeries seriesAt(List<int> marks) => TrendSeries(
          key: 'k',
          subject: 'accountancy',
          mode: 'quick',
          total: 10,
          points: [
            for (var i = 0; i < marks.length; i++)
              TrendPoint(attemptId: 'p$i', at: DateTime.utc(2026, 10, 3 + i), marks: marks[i], maxMarks: 50),
          ],
        );

    Future<(Rect chart, Rect note)> pick(WidgetTester tester, List<int> marks, double textScale) async {
      // A fresh chart each time: the picked dot of the one before must not carry over.
      await tester.pumpWidget(const SizedBox());
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: TrendSection(series: [seriesAt(marks)])),
        brightness: Brightness.dark,
        disableAnimations: true,
        textScale: textScale,
      );
      final chart = tester.getRect(find.byType(CustomPaint).last);
      await tester.tapAt(Offset(chart.right - 10, chart.center.dy));
      await tester.pump();
      return (chart, tester.getRect(find.byType(FakeGlass)));
    }

    testWidgets('a dot near the top gets its note inside the chart, off the marks scale and the dates', (tester) async {
      final (chart, note) = await pick(tester, [41, 44, 49], 1);
      expect(note.top, greaterThanOrEqualTo(chart.top));
      // Never over the date row under the plot (the walk-through had Show me on the date).
      expect(note.bottom, lessThanOrEqualTo(chart.bottom));
      // Never over the marks scale ("25", "0") at the left of the plot.
      expect(note.left, greaterThanOrEqualTo(chart.left + 30));
      expect(note.right, lessThanOrEqualTo(chart.right));
    });

    testWidgets('the note is wider at large text, so Show me does not overflow', (tester) async {
      final (chart, note) = await pick(tester, [41, 44, 49], 1.6);
      expect(tester.takeException(), isNull);
      expect(note.width, greaterThan(176));
      expect(note.top, greaterThanOrEqualTo(chart.top));
      expect(note.left, greaterThanOrEqualTo(chart.left + 30));
    });

    testWidgets('a dot too low for the note above it still keeps the note inside the chart', (tester) async {
      for (final marks in [
        [20, 30, 25],
        [20, 10, 2],
        [2, 4, 1],
      ]) {
        final (chart, note) = await pick(tester, marks, 1);
        expect(note.top, greaterThanOrEqualTo(chart.top), reason: '$marks');
        expect(note.bottom, lessThanOrEqualTo(chart.bottom), reason: '$marks');
        expect(note.left, greaterThanOrEqualTo(chart.left + 30), reason: '$marks');
      }
    });

    testWidgets('a dot at the left edge of the plot keeps the note off the marks scale', (tester) async {
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: TrendSection(series: [seriesAt([33, 8])])),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      final chart = tester.getRect(find.byType(CustomPaint).last);
      await tester.tapAt(Offset(chart.left + 36, chart.center.dy));
      await tester.pump();
      final note = tester.getRect(find.byType(FakeGlass));
      expect(note.left, greaterThanOrEqualTo(chart.left + 30));
      expect(note.top, greaterThanOrEqualTo(chart.top));
      expect(note.bottom, lessThanOrEqualTo(chart.bottom));
    });
  });

  group('honest units', () {
    test('the record never states net marks alone: it carries the marks on offer and the sessions', () {
      expect(InsightsCopy.netOver(1346, 3250, 10), '+1346 net marks of 3250 on offer over 10 sessions');
      expect(InsightsCopy.netOver(-4, 50, 1), '-4 net marks of 50 on offer over 1 session');
    });

    test('the Review entry row gives the share right, which means the same over papers of any length', () {
      expect(InsightsCopy.insightsEntryNote(77, 10), '77% right over 10 sessions');
      expect(InsightsCopy.insightsEntryNote(null, 1), '1 session');
      expect(InsightsCopy.insightsEntryNote(77, 10), isNot(contains('net marks')));
    });

    testWidgets('the week compare says what its figures count', (tester) async {
      final v = rich();
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: WeekSection(thisWeek: v.thisWeek, lastWeek: v.lastWeek, activeDays: v.activeDaysLast14),
          ),
        ),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.text('+${v.thisWeek.net}'), findsOneWidget);
      expect(find.text('net marks'), findsNWidgets(2));
      expect(find.bySemanticsLabel('+${v.thisWeek.net} net marks'), findsOneWidget);
    });

    testWidgets('the Pro row is read out once, not as "Pro. Pro."', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Padding(padding: EdgeInsets.all(16), child: ProRow('3 more chapters with Pro')), brightness: Brightness.dark, disableAnimations: true);
      expect(find.bySemanticsLabel('3 more chapters with Pro.'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'Pro\. Pro')), findsNothing);
      handle.dispose();
    });
  });

  group('AI replies', () {
    testWidgets('a model reply says it can be wrong and can be reported; a record answer does not', (tester) async {
      var reported = 0;
      await pumpMockmob(
        tester,
        Column(
          children: [
            AskMessageView(
              message: const AskMessage.reply('Try the cash flow chapter next.', origin: AskOrigin.model, requestId: 'r1'),
              onRetry: () {},
              onReport: () => reported++,
            ),
            AskMessageView(
              message: const AskMessage.reply('You lost 35 marks in Partnership.', origin: AskOrigin.phone),
              onRetry: () {},
              onReport: () => reported++,
            ),
          ],
        ),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.text(InsightsCopy.aiCaveat), findsOneWidget);
      expect(find.text(InsightsCopy.reportReply), findsOneWidget);
      await tester.tap(find.text(InsightsCopy.reportReply));
      expect(reported, 1);
    });
  });
}
