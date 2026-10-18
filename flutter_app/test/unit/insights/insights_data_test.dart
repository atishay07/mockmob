import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/insights/data/practice_question.dart';
import 'package:mockmob/features/insights/data/readout.dart';
import 'package:mockmob/features/insights/data/subject_names.dart';
import 'package:mockmob/features/insights/data/trend.dart';
import 'package:mockmob/features/insights/insights_paths.dart';

import '../core_data/support/fixtures.dart';
import 'support/insights_fixtures.dart';

void main() {
  group('PrepInsights.fromJson', () {
    test('reads the ledger, chapters, pace, week and findings', () {
      final v = rich();
      expect(v.isReady, isTrue);
      expect(v.sessions, 7);
      expect(v.ledger.net, 324);
      expect(v.ledger.right, 69);
      expect(v.ledger.wrong, 21);
      expect(v.ledger.blank, 22);
      expect(v.accuracy.pct, 77);
      expect(v.ranked.first.chapter, 'Partnership: admission of a partner');
      expect(v.ranked.first.open, 35);
      expect(v.thin, hasLength(1));
      expect(v.pace.usable, isTrue);
      expect(v.pace.slowest.first.seconds, 184);
      expect(v.changes.net, -18);
      expect(v.thisWeek.sessions, 3);
      expect(v.activeDaysLast14, 5);
      expect(v.findings.first.isLeak, isTrue);
      expect(v.findings.first.actionHref, '/dashboard?subject=accountancy&mode=quick');
    });

    test('an empty record is not ready, and an unknown rate is not zero', () {
      expect(empty().isReady, isFalse);
      expect(thin().lastWeek.accuracy.known, isFalse);
      expect(thin().lastWeek.accuracy.pct, isNull);
    });
  });

  group('readout (port of data/prepos_insights.js)', () {
    test('ranks the chapter first, then changes, pace and blanks', () {
      final ids = readout(rich(), limit: 6).map((f) => f.id).toList();
      expect(ids, ['chapter', 'changes', 'pace', 'skips']);
    });

    test('the chapter finding matches the website wording and its n', () {
      final f = readout(rich()).first;
      expect(f.headline, 'Partnership: admission of a partner is where the most marks are open');
      expect(f.detail, contains('6 right, 4 wrong, 3 left blank out of 13 questions over 3 sessions'));
      expect(f.detail, contains('worth 35 marks'));
      expect(f.n, 13);
    });

    test('thin chapters say so instead of ranking', () {
      expect(readout(thin()).single.id, 'thin');
    });

    test('nothing to read out from an empty record', () {
      expect(readout(empty()), isEmpty);
    });
  });

  group('answerFromInsights', () {
    test('returns null for questions not about the record', () {
      expect(answerFromInsights('What is goodwill in accounting?', rich()), isNull);
    });

    test('answers a chapter question from the record, with its action', () {
      final a = answerFromInsights('Where am I losing marks?', rich())!;
      expect(a.reply, startsWith('Partnership: admission of a partner is where the most marks are open.'));
      // "Practise <chapter>" must land on that chapter's setup, not all-chapters Quick practice.
      final location = InsightsPaths.locationFor(a.actions.single.$2);
      expect(location, InsightsPaths.practiseChapter('accountancy', 'Partnership: admission of a partner'));
      expect(Uri.parse(location!).queryParameters['chapter'], 'Partnership: admission of a partner');
      expect(Uri.parse(location).path, '/practice/setup/chapter');
    });

    test('pace detail is Pro on a free account', () {
      final a = answerFromInsights('Am I too slow on wrong answers?', rich(), pro: false)!;
      expect(a.reply, contains('not part of your plan'));
      final pro = answerFromInsights('Am I too slow on wrong answers?', rich())!;
      expect(pro.reply, contains('Your slowest question took 3:04, against a typical 41s'));
    });

    test('the week answer describes, with the likely range', () {
      final a = answerFromInsights('How was my week?', rich())!;
      expect(a.reply, contains('Last 7 days: 3 sessions, 40 questions, 128 net marks, 79% accuracy (likely range 63 to 90%)'));
      expect(a.reply, contains('The week before: 2 sessions, 84 net marks.'));
    });

    test('only whole words about the record count, never pieces of other words', () {
      for (final q in [
        'What is the time period of a pendulum in this sample space question',
        'How does the exchange rate change the benchmarks for overtime pay',
        'What makes a weak acid different from a strong one in this chapterwise test',
      ]) {
        expect(answerFromInsights(q, rich()), isNull, reason: q);
      }
    });

    test('the Ask why seed and pasted question text always go to the model', () {
      const seed = 'Explain this question step by step: "Which of these is the time period of a swing?" The answer is B.';
      expect(answerFromInsights(seed, rich()), isNull);
      expect(answerFromInsights('Explain this question: where am I losing marks in time', rich()), isNull);
      expect(answerFromInsights('I lost marks on "Find the time taken by the train" why', rich()), isNull);
    });

    test('short plain questions about the student still answer on the phone', () {
      for (final q in ['Where am I losing marks?', 'Which chapter is weak?', 'Why am I losing marks in chapters', 'How is my progress']) {
        expect(answerFromInsights(q, rich()), isNotNull, reason: q);
      }
    });

    test('an empty record points at the first session', () {
      final a = answerFromInsights('Which chapter is weak?', empty())!;
      expect(a.reply, contains('nothing to analyse yet'));
    });
  });

  group('trend', () {
    test('never mixes formats and opens on the latest format with a line', () {
      final series = trendSeries(trendAttempts());
      expect(series, hasLength(2));
      final quick = series.firstWhere((s) => s.mode == 'quick');
      expect(quick.points.map((p) => p.marks), [22, 28, 21, 39]);
      expect(quick.maxMarks, 50);
      expect(defaultSeries(series)!.key, quick.key);
      expect(quick.label, 'Accountancy, Quick 10');
    });

    test('a single format with one session is still offered, as a point', () {
      final one = trendSeries([trendAttempts()[2]]);
      expect(defaultSeries(one)!.points, hasLength(1));
      expect(one.single.label, 'Economics, full mock');
    });

    test('subject lines count right out of answered', () {
      final lines = subjectLines(trendAttempts());
      final acc = lines.firstWhere((l) => l.subject == 'accountancy');
      expect(acc.sessions, 4);
      expect(acc.right, 24);
      expect(acc.wrong, 10);
      expect(acc.accuracyPct, 71);
      expect(subjectLines([attemptOf(questions: chapterOf('X', blank: 3))]).single.accuracyPct, isNull);
    });
  });

  group('questions', () {
    test('options from strings, maps and objects; the key from a letter, text or index', () {
      expect(optionsFrom(['p', 'q']).map((o) => o.key), ['A', 'B']);
      expect(optionsFrom({'A': 'p', 'B': 'q'}).last.text, 'q');
      final opts = optionsFrom([
        {'key': 'A', 'text': 'p'},
        {'label': 'q'},
      ]);
      expect(opts.last.key, 'B');
      expect(keyFrom('b', opts), 'B');
      expect(keyFrom('p', opts), 'A');
      expect(keyFrom(1, opts), 'B');
      expect(keyFrom('Z', opts), isNull);
      expect(question('x', key: 'Z').hasUsableKey, isFalse);
    });
  });

  group('paths', () {
    test('maps web hrefs from findings and replies into the app', () {
      expect(InsightsPaths.locationFor('/review'), AppRoutes.review);
      expect(InsightsPaths.locationFor('/saved'), InsightsPaths.saved);
      expect(InsightsPaths.locationFor('/explore'), InsightsPaths.stream);
      expect(InsightsPaths.locationFor('/mentor'), InsightsPaths.insights);
      expect(InsightsPaths.locationFor('/mentor?tab=ask'), InsightsPaths.ask);
      expect(InsightsPaths.locationFor('/dashboard?subject=accountancy&mode=quick'), '/practice/setup/quick?subject=accountancy');
      expect(InsightsPaths.locationFor('/pricing'), isNull);
      expect(InsightsPaths.locationFor('https://evil.example/x'), isNull);
    });

    test('builds stream and chapter links', () {
      expect(InsightsPaths.streamFor(subject: 'economics', difficulty: 'hard'), '/practice/stream?subject=economics&difficulty=hard');
      expect(InsightsPaths.savedStreamFrom('q9'), '/practice/stream?source=saved&start=q9');
      expect(InsightsPaths.practiseChapter('business_studies', 'Planning'), '/practice/setup/chapter?subject=business_studies&chapter=Planning');
    });

    test('subject names cover every supported subject and internal aliases', () {
      expect(subjectDisplayName('gat'), 'General Test');
      expect(subjectDisplayName('business'), 'Business Studies');
      expect(subjectDisplayName('political_science'), 'Political Science');
      expect(subjectDisplayName('some_new_subject'), 'Some New Subject');
    });
  });
}
