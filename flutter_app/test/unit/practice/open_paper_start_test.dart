// v15 walk, credits: a start that spends credits waits for a paper that is already open. Nothing is charged for a second one,
// the paper that is open is said, and the Start key becomes the one that continues it.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart' show SessionDraftRepository;
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/open_paper.dart';
import 'package:mockmob/features/practice/model/pending_start.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/result/:attemptId'),
  stubRoute('/result/:attemptId'),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
];

class _OneOpen implements OpenPaperResolver {
  _OneOpen(this.paper);

  final OpenPaper paper;

  @override
  Future<OpenPaper?> offer(HeldHint? held) async => paper;

  @override
  Future<OpenPaper?> blocker(HeldHint? held) async => paper;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _NoDrafts implements SessionDraftRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

final OpenPaper _open = OpenPaper(
  kind: OpenPaperKind.pending,
  subjectId: 'accountancy',
  apiMode: 'full',
  count: 50,
  mockNumber: 9,
  start: PendingStart(
    draftKey: 'full:accountancy',
    generationKey: 'gen-key-123456',
    at: testNow.subtract(const Duration(minutes: 3)),
    selection: PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy'),
    mockNumber: 9,
  ),
);

void main() {
  setUpAll(loadAppFonts);

  testWidgets('Start mock with a paper already open charges nothing, says so, and the key then continues that paper', (tester) async {
    final starter = FakeStarter();
    final router = await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(
        quotes: FakeQuoteRepository((s, m, c, p) => m == 'full' ? creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50) : dailyFree(count: c ?? 10)),
        starter: starter,
        attempts: const [],
        nothingOpen: false,
        extra: [
          openPaperResolverProvider.overrideWithValue(_OneOpen(_open)),
          paperContinuerProvider.overrideWith(
            (ref) => PaperContinuer(
              starter: starter,
              startEngine: (_) async => throw StateError('not taken over here'),
              drafts: _NoDrafts(),
              changed: () {},
            ),
          ),
        ],
      ),
    );
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.scrollUntilVisible(find.text(PracticeCopy.fullMockTitle), 200, scrollable: find.byType(Scrollable).first);
    await tester.pump();
    await tester.tap(find.text(PracticeCopy.fullMockTitle));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }
    await tester.tap(find.widgetWithText(KeyButton, PracticeCopy.startMock));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(starter.started, isEmpty, reason: 'no second paper was asked for, so no second charge');
    expect(find.text(PracticeCopy.openFirst(apiMode: 'full')), findsOneWidget);
    expect(find.widgetWithText(KeyButton, PracticeCopy.openKey(apiMode: 'full')), findsOneWidget);

    // The key asks for the same paper again, with the key it was first asked with, and opens it.
    await tester.tap(find.widgetWithText(KeyButton, PracticeCopy.openKey(apiMode: 'full')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(starter.started.single.mode, PracticeMode.full);
    expect(router.state.uri.path, '/run/sess-1');
  });
}
