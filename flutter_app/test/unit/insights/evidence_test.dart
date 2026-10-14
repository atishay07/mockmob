import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/evidence.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/subject_names.dart';
import 'package:mockmob/features/insights/data/trend.dart';
import 'package:mockmob/features/insights/widgets/ask_messages.dart';
import 'package:mockmob/features/insights/widgets/evidence.dart';
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

  group('trend readout', () {
    // The readout above the chart is the one place a session's marks, change, day and Show me
    // appear: the latest session until a dot is picked, then that dot. No second card.
    Future<void> pump(WidgetTester tester, TrendSeries series, {double textScale = 1}) async {
      await tester.pumpWidget(const SizedBox());
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: TrendSection(series: [series])),
        brightness: Brightness.dark,
        disableAnimations: true,
        textScale: textScale,
        size: const Size(384, 900),
      );
    }

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

    testWidgets('it opens on the latest session, with its change and one Show me; the ends are dated', (tester) async {
      final handle = tester.ensureSemantics();
      await pump(tester, defaultSeries(trendSeries(trendAttempts()))!);
      expect(find.text('3 Oct'), findsWidgets);
      expect(find.text('11 Oct'), findsWidgets);
      expect(find.text('Show me'), findsOneWidget);
      expect(find.bySemanticsLabel('39 of 50'), findsOneWidget);
      expect(find.text('+18'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('a tapped dot moves the whole readout to that session, with no extra card', (tester) async {
      final handle = tester.ensureSemantics();
      await pump(tester, seriesAt([33, 8, 21]));
      expect(find.bySemanticsLabel('21 of 50'), findsOneWidget);
      expect(find.text('+13'), findsOneWidget);
      final chart = tester.getRect(find.byType(CustomPaint).last);
      await tester.tapAt(Offset(chart.left + 36, chart.center.dy));
      await tester.pump();
      // The first session: its marks, no change to compare with, still exactly one Show me.
      expect(find.bySemanticsLabel('33 of 50'), findsOneWidget);
      expect(find.bySemanticsLabel('21 of 50'), findsNothing);
      expect(find.byKey(const ValueKey('trend-delta')), findsNothing);
      expect(find.text('Show me'), findsOneWidget);
      expect(find.text('3 Oct, 10 questions'), findsOneWidget);
      // Tapping it again goes back to the latest session.
      await tester.tapAt(Offset(chart.left + 36, chart.center.dy));
      await tester.pump();
      expect(find.bySemanticsLabel('21 of 50'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('a middle dot shows its change on the session before it', (tester) async {
      await pump(tester, seriesAt([33, 8, 21]));
      final chart = tester.getRect(find.byType(CustomPaint).last);
      await tester.tapAt(Offset(chart.center.dx, chart.center.dy));
      await tester.pump();
      expect(find.text('−25'), findsOneWidget);
    });

    testWidgets('the readout sits above the chart and wraps at large text without overflowing', (tester) async {
      for (final scale in [1.0, 1.6]) {
        await pump(tester, seriesAt([41, 44, 49]), textScale: scale);
        final chart = tester.getRect(find.byType(CustomPaint).last);
        final readout = tester.getRect(find.byKey(const ValueKey('trend-readout')));
        expect(tester.takeException(), isNull, reason: 'x$scale');
        expect(readout.bottom, lessThanOrEqualTo(chart.top), reason: 'x$scale');
        expect(readout.right, lessThanOrEqualTo(chart.right + 1), reason: 'x$scale');
        // Show me is a 48 dp target.
        expect(tester.getSize(find.byType(ShowMeRow)).height, greaterThanOrEqualTo(48), reason: 'x$scale');
      }
    });

    testWidgets('one session is a figure and a plain "not enough yet" line, with no empty chart', (tester) async {
      await pump(tester, seriesAt([0]));
      expect(find.textContaining('Not enough yet'), findsOneWidget);
      // The press veil of Show me is a CustomPaint too, so look for the chart's own painter.
      expect(find.byWidgetPredicate((w) => w is CustomPaint && '${w.painter.runtimeType}' == '_TrendPainter'), findsNothing);
    });
  });

  group('honest units', () {
    test('the record never states net marks alone: it carries the marks on offer and the sessions', () {
      expect(InsightsCopy.netOver(1346, 3250, 10), '+1346 net marks of 3250 on offer over 10 sessions');
      expect(InsightsCopy.netOver(-4, 50, 1), '−4 net marks of 50 on offer over 1 session');
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
