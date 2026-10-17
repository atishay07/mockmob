import 'package:flutter/widgets.dart' show Scrollable, ValueKey;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/features/paper_reel/paper_reel.dart';
import 'package:mockmob/features/result/data/result_providers.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

/// D29 on the result: a quiet "Play it back" row under the answer sheet opens this paper's reel,
/// always (Today offers the reel once per paper; the result never takes it away).

String _at(GoRouter r) => r.routerDelegate.currentConfiguration.uri.toString();

void main() {
  setUpAll(loadAppFonts);

  Future<GoRouter> pump(WidgetTester tester, {bool withDetail = true}) async {
    final d = detail();
    final router = await pumpResultRoute(
      tester,
      openFolds: true,
      location: '/result/a7',
      overrides: resultOverrides(
        attemptId: 'a7',
        data: RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: withDetail ? d : null),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));
    return router;
  }

  final entry = find.byKey(const ValueKey('reel-result-entry'));

  /// Taps the row and lets the reel's route come in (one frame to build it, then its 280 ms).
  Future<void> openReel(WidgetTester tester) async {
    await tester.scrollUntilVisible(entry, 300, scrollable: find.byType(Scrollable).first);
    await tester.tap(entry);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  testWidgets('the row sits under the answer sheet, says its length, and is one row', (tester) async {
    await pump(tester);
    await tester.scrollUntilVisible(entry, 300, scrollable: find.byType(Scrollable).first);
    final reel = PaperReelModel.tryFrom(detail(), subjectLabel: 'Accountancy')!;
    expect(find.text('Play it back'), findsOneWidget);
    expect(find.text('Your paper, question by question, in ${reel.seconds} s'), findsOneWidget);
    expect(entry, findsOneWidget);
  });

  testWidgets('no record of the paper, no row: it is never offered for a paper it cannot play', (tester) async {
    await pump(tester, withDetail: false);
    expect(entry, findsNothing);
  });

  testWidgets('a tap opens the reel over the result; Done closes it and the row is still there', (tester) async {
    await pump(tester);
    await openReel(tester);
    expect(find.byType(PaperReel), findsOneWidget);
    // Skip is one tap and lands on the end state, where the key reads Done.
    await tester.tap(find.byKey(const ValueKey('reel-skip')));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Done'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('reel-skip')));
    await tester.pumpAndSettle();
    expect(find.byType(PaperReel), findsNothing);
    expect(_at(GoRouter.of(tester.element(find.byType(Scrollable).first))), '/result/a7');
    expect(entry, findsOneWidget, reason: 'always available');
  });

  testWidgets('the reel\'s one closing key goes where the same move goes from the result', (tester) async {
    await pump(tester);
    final reel = PaperReelModel.tryFrom(detail(), subjectLabel: 'Accountancy')!;
    await openReel(tester);
    await tester.tap(find.byKey(const ValueKey('reel-skip')));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.byKey(const ValueKey('reel-next-move')));
    await tester.pumpAndSettle();
    expect(find.byType(PaperReel), findsNothing);
    switch (reel.nextMove.kind) {
      case ReelMoveKind.repairChapter:
        // The chapter's wrong answers, the first one first, each counted (the blanks have no repair).
        final wrong = {for (final q in reel.questions) if (q.result == ReelResult.wrong) q.qid};
        final open = [for (final q in reel.nextMove.qids) if (wrong.contains(q)) q];
        expect(find.text('AT /review/repair/a7/${open.first}?count=${open.length}'), findsOneWidget);
      case ReelMoveKind.reviewMistakes:
        expect(entry, findsOneWidget, reason: 'it stays on the result, at the mistakes');
      case ReelMoveKind.nextMock:
        expect(find.textContaining('AT /practice/setup/full?subject='), findsOneWidget);
    }
  });
}
