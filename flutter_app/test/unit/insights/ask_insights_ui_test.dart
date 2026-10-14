import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ask_citation.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/evidence.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/readout.dart';
import 'package:mockmob/features/insights/widgets/answer_sheet.dart';
import 'package:mockmob/features/insights/widgets/answer_text.dart';
import 'package:mockmob/features/insights/widgets/ask_prompts.dart';
import 'package:mockmob/features/insights/widgets/record_sections.dart';

import '../../helpers/golden_harness.dart';
import '../core_data/support/fixtures.dart';
import 'support/insights_fixtures.dart';

void main() {
  group('the answer sheet', () {
    test('one bubble per question while they fit, in the order right, wrong, blank', () {
      final c = SheetCounts.of(69, 21, 22);
      expect((c.right, c.wrong, c.blank, c.perBubble), (69, 21, 22, 1));
      expect(c.cells, 112);
    });

    test('a bigger record is scaled to the room, in proportion, and says how many each bubble stands for', () {
      final c = SheetCounts.of(300, 100, 100);
      expect(c.perBubble, 5);
      expect(c.cells, lessThanOrEqualTo(120));
      expect(c.right, 60);
      expect(c.wrong, 20);
      expect(c.blank, 20);
    });

    test('a kind with any question keeps at least one bubble, and nothing is invented for a kind with none', () {
      final c = SheetCounts.of(1000, 1, 0);
      expect(c.wrong, greaterThanOrEqualTo(1));
      expect(c.blank, 0);
      expect(c.cells, lessThanOrEqualTo(120));
    });

    testWidgets('it is one labelled picture that carries the counts', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Padding(padding: EdgeInsets.all(16), child: AnswerSheet(right: 69, wrong: 21, blank: 22)), brightness: Brightness.dark, disableAnimations: true);
      expect(find.bySemanticsLabel('69 right, 21 wrong, 22 left blank'), findsOneWidget);
      handle.dispose();
    });
  });

  group('a reply set for reading', () {
    test('the first short sentence leads and the rest is the body', () {
      final p = splitAnswer('Partnership is where the most marks are open. Accountancy: 6 right, 4 wrong. Those 7 questions were worth 35 marks.');
      expect(p.lead, 'Partnership is where the most marks are open.');
      expect(p.body, startsWith('Accountancy: 6 right'));
    });

    test('one sentence, or a model paragraph, has no lead', () {
      expect(splitAnswer('Try the cash flow chapter next.').lead, isNull);
      expect(splitAnswer('Because the old partners give up part of their profit. They are compensated.', wantLead: false).lead, isNull);
    });

    testWidgets('a figure is set heavier with its unit, and the whole reply is one spoken line', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(
        tester,
        const Padding(padding: EdgeInsets.all(16), child: AnswerText(parts: AnswerParts(lead: 'You lost 35 marks in Partnership.', body: 'That was 6 right and 4 wrong.'))),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.bySemanticsLabel('You lost 35 marks in Partnership. That was 6 right and 4 wrong.'), findsOneWidget);
      handle.dispose();
    });
  });

  group('the sessions behind a reply', () {
    final v = rich();
    final ev = RecordEvidence(trendAttempts(), now: DateTime.utc(2026, 10, 13, 14, 30));

    test('a record answer cites the finding it opens with: its questions and its sessions', () {
      final f = readout(v, limit: 6).first;
      final cite = citationFor(AskMessage.reply('${f.headline}. ${f.detail}', origin: AskOrigin.phone), v, ev);
      expect(cite, isNotNull);
      expect(cite!.questions, f.n);
      expect(cite.sessions, ev.forFinding(f, v));
    });

    test('the week answer cites the last 7 days', () {
      final cite = citationFor(const AskMessage.reply('Last 7 days: 3 sessions, 40 questions, 128 net marks.', origin: AskOrigin.phone), v, ev);
      expect(cite!.questions, v.thisWeek.questions);
      final from = ev.now.subtract(const Duration(days: 7));
      expect(cite.sessions.every((a) => !a.completedAt.isBefore(from)), isTrue);
    });

    test('any other record answer rests on the whole record', () {
      final cite = citationFor(const AskMessage.reply('Nothing else to say.', origin: AskOrigin.record), v, ev);
      expect(cite!.questions, v.questions);
    });

    test('a model reply, a pending one, a failure and the student never claim the record', () {
      expect(citationFor(const AskMessage.reply('x', origin: AskOrigin.model), v, ev), isNull);
      expect(citationFor(const AskMessage.reply('x', origin: AskOrigin.paused), v, ev), isNull);
      expect(citationFor(const AskMessage.sending(), v, ev), isNull);
      expect(citationFor(const AskMessage.failed(AskFailure.offline), v, ev), isNull);
      expect(citationFor(const AskMessage.student('hi'), v, ev), isNull);
    });

    test('with no record read yet there is nothing to cite', () {
      expect(citationFor(const AskMessage.reply('x', origin: AskOrigin.phone), null, null), isNull);
    });
  });

  group('prompts', () {
    test('record prompts carry a live line from the record and never invent one', () {
      final withRecord = recordPrompts(rich(), pro: true);
      expect(withRecord[0].preview, contains('35 marks open in Partnership: admission of a partner'));
      expect(withRecord[2].preview, 'Wrong answers take 58s, right ones 37s');
      expect(withRecord[3].preview, '3 sessions, 40 questions in 7 days');
      final none = recordPrompts(null);
      expect(none.every((p) => p.preview == null), isTrue);
    });

    test('pace is part of Pro: a free account sees no pace line', () {
      expect(recordPrompts(rich(), pro: false)[2].preview, isNull);
    });

    test('record prompts are answered on the phone, so they are free; the others cost a credit', () {
      for (final p in recordPrompts(rich())) {
        expect(p.free, isTrue, reason: p.text);
      }
      for (final p in openPrompts(rich())) {
        expect(p.free, isFalse, reason: p.text);
      }
    });

    test('every record prompt really is answered from the record, and no AI prompt is', () {
      final v = rich();
      for (final p in [...recordPrompts(v), ...moreRecordPrompts()]) {
        expect(answerFromInsights(p.text, v), isNotNull, reason: p.text);
      }
      for (final p in [...openPrompts(v), ...openPrompts(null)]) {
        expect(answerFromInsights(p.text, v), isNull, reason: p.text);
      }
    });

    test('AI prompts are seeded with the weakest chapter', () {
      expect(openPrompts(rich())[0].text, InsightsCopy.promptExplain('Partnership: admission of a partner'));
    });
  });

  group('the week bubbles', () {
    testWidgets('a day with a session is inked and the others stay hollow', (tester) async {
      final v = rich();
      final now = DateTime(2026, 10, 13, 14, 30);
      Attempt on(DateTime d) => attemptOf(id: 'w${d.day}', completedAt: d.millisecondsSinceEpoch, questions: chapterOf('Cash flow statement', right: 3, wrong: 1, blank: 1));
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: WeekSection(thisWeek: v.thisWeek, lastWeek: v.lastWeek, activeDays: v.activeDaysLast14, evidence: [on(DateTime(2026, 10, 13, 9)), on(DateTime(2026, 10, 11, 9))], now: now),
          ),
        ),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.bySemanticsLabel('2 of 7 days with a session'), findsOneWidget);
      expect(find.bySemanticsLabel('0 of 7 days with a session'), findsOneWidget);
    });
  });
}
