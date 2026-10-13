import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/evidence.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/subject_names.dart';
import 'package:mockmob/features/insights/data/trend.dart';
import 'package:mockmob/features/insights/widgets/ask_messages.dart';
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
