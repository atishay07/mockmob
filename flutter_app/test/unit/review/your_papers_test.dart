// Your papers (19 Oct, owner D106 and G20): the strip, the subject filter, the papers newest first, then Mistakes to repair by
// chapter, every number read from one record; a fresh account sees one first step; "See it in Your papers" lands on the row.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderContainer;
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show NetworkStatusNotifier, networkStatusProvider;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart' show PendingResult;
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/widgets/key_button.dart' show KeyButton;
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/model/review_chapters.dart';
import 'package:mockmob/features/review/model/review_record_adapter.dart';
import 'package:mockmob/features/review/model/your_papers.dart';
import 'package:mockmob/features/review/review_routes.dart' show reviewScreen;
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/review/widgets/your_papers.dart';
import 'package:mockmob/features/review/your_papers_link.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../practice/support/harness.dart' show pumpRouted, stubRoute;
import 'support/review_fixtures.dart';

class _Online extends NetworkStatusNotifier {
  @override
  NetworkStatus build() => NetworkStatus.online;
}

/// Your papers behind the real route builder (so `?paper=` is read as the app reads it), with its results stubbed.
Future<GoRouter> _routed(WidgetTester tester, String location, List<Attempt> attempts, {Size size = const Size(384, 800)}) => pumpRouted(
  tester,
  location: location,
  size: size,
  routes: [
    GoRoute(path: '/review', builder: reviewScreen),
    stubRoute('/practice/result/:attemptId'),
    stubRoute('/result/:attemptId'),
    stubRoute('/result/:attemptId/sealed'),
  ],
  overrides: [networkStatusProvider.overrideWith(_Online.new), ...reviewOverrides(attempts: attempts)],
);

/// An English mock, the newest paper of all (13 Oct), with two wrong answers.
final _english = Attempt.fromJson(
  mockJson(id: 'e1', completedAt: DateTime.utc(2026, 10, 13, 5, 0), subject: 'english', wrong: {2, 7}),
);

/// A second Economics quick 10, two days after the first, better by 6 marks (one wrong became right).
final _quick2 = Attempt.fromJson(
  mockJson(id: 'q2', completedAt: DateTime.utc(2026, 10, 10, 14, 30), mode: 'quick', count: 10, subject: 'economics', chapter: 'Money and banking'),
);

YourPapersView _view(List<Attempt> attempts, {Set<String> unopened = const {}, String? subject, List<dynamic> records = const []}) {
  final index = buildReviewIndex(attempts, List.castFrom(records), unopened: unopened);
  final record = reviewRecordOf(index, now: eveningUtc, unopened: unopened);
  return buildYourPapers(attempts: attempts, unopened: unopened, record: record, subject: subject);
}

Future<void> _pump(WidgetTester tester, {List<Attempt>? attempts, String? focus, List<PendingResult> unopened = const [], Size size = const Size(384, 4000)}) =>
    pumpMockmob(
      tester,
      ReviewScreen(focusPaper: focus),
      size: size,
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: reviewOverrides(attempts: attempts, unopened: unopened),
    );

void main() {
  setUpAll(loadAppFonts);

  group('the model', () {
    test('papers are newest first, named, with marks out of the maximum and a 12-hour date', () {
      final v = _view([mock6, mock7, quick, _english]);
      expect([for (final p in v.papers) p.attemptId], ['e1', 'm7', 'q1', 'm6']);
      final m7 = v.papers[1];
      expect(m7.name, 'Mock 2');
      expect(m7.subject, 'Accountancy');
      expect((m7.marks, m7.max), (mock7.marks, 250));
      expect((m7.right, m7.wrong, m7.blank), (42, 5, 3));
      expect(m7.when, 'Mon 12 Oct, 10:42 PM');
      expect(m7.location, AppRoutes.result('m7'));
      final q = v.papers[2];
      expect(q.name, 'Quick practice');
      expect(q.location, AppRoutes.practiceResult('q1'));
      // The change from the last paper of the same subject, kind and length.
      expect(m7.change, '${mock7.marks - mock6.marks >= 0 ? '+' : '−'}${(mock7.marks - mock6.marks).abs()} on Mock 1');
      expect(m7.up, mock7.marks > mock6.marks);
    });

    test('a practice set compares with the set before it, in words', () {
      final v = _view([quick, _quick2]);
      expect(v.papers.first.change, '+6 on the set before');
      expect(v.papers.first.up, isTrue);
    });

    test('the subject filter lists every subject with papers, most first, and filters papers, chapters and the strip together', () {
      final all = [mock6, mock7, quick, _quick2, _english];
      final v = _view(all);
      expect([for (final s in v.subjects) (s.name, s.papers)], [('Accountancy', 2), ('Economics', 2), ('English', 1)]);
      final eco = _view(all, subject: 'Economics');
      expect(eco.subject, 'Economics');
      expect([for (final p in eco.papers) p.attemptId], ['q2', 'q1']);
      expect(eco.strip.papers, 2);
      expect(eco.strip.latest!.attemptId, 'q2');
      expect(eco.body.rows.every((r) => subjectName(r.subject ?? '') == 'Economics'), isTrue);
      expect(eco.strip.toRepair, 1);
      // A subject with no papers falls back to every subject.
      expect(_view(all, subject: 'History').subject, isNull);
    });

    test('one subject has nothing to filter', () {
      expect(_view([mock6, mock7]).subjects, isEmpty);
    });

    test('the numbers agree: the strip, the chapters and the badge read the same open repairs, for all and per subject', () {
      final all = [mock6, mock7, quick, _english];
      final index = buildReviewIndex(all, [repairedRecord]);
      final v = _view(all, records: [repairedRecord]);
      final chapters = v.body.rows.fold<int>(0, (n, r) => n + r.open.length);
      expect(v.strip.toRepair, chapters);
      expect(v.strip.toRepair, index.openShown);
      final container = ProviderContainer(overrides: [reviewIndexProvider.overrideWithValue(index)]);
      addTearDown(container.dispose);
      expect(container.read(openRepairsProvider), v.strip.toRepair);
      // The subjects add up to the whole.
      final parts = [for (final s in v.subjects) _view(all, subject: s.name, records: [repairedRecord]).strip.toRepair];
      expect(parts.fold<int>(0, (a, b) => a + b), v.strip.toRepair);
      // And the papers count is the rows' count.
      expect(v.strip.papers, v.papers.length);
    });

    test('a sealed paper shows no marks, opens the sealed sheet, and its mistakes wait for the reveal everywhere', () {
      final all = [mock6, mock7];
      final v = _view(all, unopened: {'m7'});
      final m7 = v.papers.first;
      expect(m7.sealed, isTrue);
      expect(m7.marks, isNull);
      expect(m7.location, AppRoutes.resultSealed('m7'));
      expect(v.strip.latest!.attemptId, 'm6');
      final index = buildReviewIndex(all, const [], unopened: {'m7'});
      expect(v.strip.toRepair, index.openShown);
      expect(v.strip.toRepair, 2, reason: "Mock 1's two; Mock 2's five wait for its result to open");
      // The record behind the chapters leaves the sealed paper out too.
      expect(recordForSubject(reviewRecordOf(index, now: eveningUtc, unopened: {'m7'}), null).papers.map((p) => p.id), ['m6']);
    });

    test('the deep link carries the paper', () {
      expect(yourPapersLocation('p 1'), '${AppRoutes.review}?paper=p+1');
      expect(Uri.parse(yourPapersLocation('abc')).queryParameters[yourPapersFocusParam], 'abc');
    });
  });

  group('the screen', () {
    testWidgets('a fresh account with no papers sees one friendly first step with one key', (tester) async {
      await _pump(tester, attempts: const []);
      expect(find.text(ReviewCopy.firstPaperTitle), findsOneWidget);
      expect(find.text(ReviewCopy.firstPaperAction), findsOneWidget);
      expect(find.byType(KeyButton), findsOneWidget);
      expect(find.byType(PapersStripView), findsNothing);
    });

    testWidgets('a fresh account after one paper sees it at the top, with the strip over it', (tester) async {
      await _pump(tester, attempts: [quick]);
      expect(find.byType(PapersStripView), findsOneWidget);
      final rows = find.byType(PaperRowView);
      expect(rows, findsOneWidget);
      expect(tester.widget<PaperRowView>(rows).line.attemptId, 'q1');
      expect(find.text('Quick practice'), findsOneWidget);
      expect(find.text(ReviewCopy.papersCaption(1, null)), findsOneWidget);
      // One subject: no filter.
      expect(find.byType(PaperSubjectFilter), findsNothing);
      // The paper sits above Mistakes to repair.
      expect(tester.getTopLeft(rows).dy, lessThan(tester.getTopLeft(find.text(ReviewCopy.mistakesHeading)).dy));
      expect(find.bySemanticsLabel(RegExp('^1 paper sat')), findsOneWidget);
    });

    testWidgets('a heavy account filters by subject: the rows, the strip and the chapters follow', (tester) async {
      await _pump(tester, attempts: [mock6, mock7, quick, _quick2, _english]);
      expect(find.byType(PaperRowView), findsNWidgets(5));
      expect(find.byType(PaperSubjectFilter), findsOneWidget);
      await tester.tap(find.text('Economics').first);
      await tester.pumpAndSettle();
      expect(find.byType(PaperRowView), findsNWidgets(2));
      expect([for (final w in tester.widgetList<PaperRowView>(find.byType(PaperRowView))) w.line.attemptId], ['q2', 'q1']);
      expect(find.bySemanticsLabel(RegExp('^2 papers sat')), findsOneWidget);
      expect(find.text(ReviewCopy.papersCaption(2, 'Economics')), findsOneWidget);
      expect(find.textContaining('in Economics, across'), findsOneWidget);
      await tester.tap(find.text(ReviewCopy.allSubjects));
      await tester.pumpAndSettle();
      expect(find.byType(PaperRowView), findsNWidgets(5));
    });

    testWidgets('a tap on a paper opens its result and answers', (tester) async {
      final router = await _routed(tester, AppRoutes.review, [quick, mock6]);
      await tester.pump(const Duration(milliseconds: 600));
      await tester.tap(find.text('Quick practice'));
      await tester.pump(const Duration(milliseconds: 600));
      expect(router.state.uri.toString(), AppRoutes.practiceResult('q1'));
    });

    testWidgets('"See it in Your papers" lands on the row and marks it, even past the first rows and outside the filter', (tester) async {
      // Eight papers: the focused one is the oldest, past the first six.
      final many = [
        for (var i = 0; i < 8; i++)
          Attempt.fromJson(
            mockJson(id: 'k$i', completedAt: DateTime.utc(2026, 10, 1 + i, 10), mode: 'quick', count: 10, subject: i == 0 ? 'english' : 'economics', wrong: {1}),
          ),
      ];
      await _routed(tester, yourPapersLocation('k0'), many);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 900));
      final row = find.byWidgetPredicate((w) => w is PaperRowView && w.line.attemptId == 'k0');
      expect(row, findsOneWidget);
      expect(tester.widget<PaperRowView>(row).marked, isTrue);
      expect(find.byKey(const ValueKey('paper-row-mark')), findsOneWidget);
      // Brought into view.
      final rect = tester.getRect(row);
      expect(rect.top, greaterThanOrEqualTo(0));
      expect(rect.bottom, lessThanOrEqualTo(800));
    });

    testWidgets('a sealed result is a row that opens the result, never a figure that spoils it', (tester) async {
      await _pump(tester, attempts: [mock6, mock7], unopened: [PendingResult(attemptId: 'm7', receivedAt: eveningUtc)]);
      expect(find.text(ReviewCopy.openYourResult), findsOneWidget);
      final m7 = tester.widget<PaperRowView>(find.byWidgetPredicate((w) => w is PaperRowView && w.line.attemptId == 'm7'));
      expect(m7.line.marks, isNull);
    });
  });

  test('the record helpers keep the website arithmetic for a subject', () {
    final index = buildReviewIndex([mock6, mock7, quick], const []);
    final record = reviewRecordOf(index, now: eveningUtc);
    final eco = chaptersBody(recordForSubject(record, 'Economics'));
    expect(eco.rows.single.name, 'Money and banking');
    expect(eco.line.text, startsWith('Your practice set lost 6 marks'));
  });
}
