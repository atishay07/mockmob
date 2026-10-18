// A paper that is open and that this phone is not running leads Today (v15 walk, credits): the app was killed while "Start
// mock" was spinning after the server took 50 credits, and the phone had nothing to show for it. The card says what the paper
// is, when it ends if the server said, and the one key continues it. Nothing here charges.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/open_paper.dart' show ContinueFailed, ContinueResult, Continued;
import 'package:mockmob/features/practice/data/practice_starter.dart' show StartFailure;
import 'package:mockmob/features/practice/model/open_paper.dart';
import 'package:mockmob/features/practice/model/pending_start.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

final DateTime _now = DateTime.utc(2026, 10, 18, 14, 10);

OpenPaper _held() => OpenPaper(
      kind: OpenPaperKind.held,
      subjectId: 'accountancy',
      apiMode: 'full',
      count: 50,
      mockNumber: 9,
      endsAt: _now.add(const Duration(minutes: 47)),
      sessionId: 'sess-9',
    );

OpenPaper _pending() => OpenPaper(
      kind: OpenPaperKind.pending,
      subjectId: 'accountancy',
      apiMode: 'full',
      count: 50,
      mockNumber: 9,
      start: PendingStart(
        draftKey: 'full:accountancy',
        generationKey: 'gen-key-123456',
        at: _now.subtract(const Duration(minutes: 3)),
        selection: PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy'),
        mockNumber: 9,
      ),
    );

final _overrides = [
  authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
];

void main() {
  setUpAll(loadAppFonts);

  Future<List<Object>> pump(
    WidgetTester tester,
    OpenPaper paper, {
    Future<ContinueResult> Function(OpenPaper)? onContinue,
    List<OpenPaper>? letGo,
  }) async {
    final events = <Object>[];
    final view = buildToday(ashaInputs(now: _now, openPaper: paper));
    await pumpMockmob(
      tester,
      TodayBody(
        view: view,
        skeletonDelay: Duration.zero,
        callbacks: TodayCallbacks(
          onAction: events.add,
          onTarget: events.add,
          onContinuePaper: onContinue ?? (p) async => Continued(p.sessionId ?? 'sess-new'),
          onLetGoPaper: (p) async => letGo?.add(p),
        ),
      ),
      size: const Size(360, 2000),
      disableAnimations: true,
      overrides: _overrides,
    );
    return events;
  }

  group('what Today leads with', () {
    test('a paper the server holds leads, named with its number and the time it ends on the student\'s clock', () {
      final view = buildToday(ashaInputs(now: _now, openPaper: _held()));
      final hero = view.hero! as OpenPaperHero;
      expect(hero.title, 'Mock 9, Accountancy');
      expect(hero.keyLabel, 'Continue your full mock');
      expect(hero.line, contains('8:27 PM'), reason: '47 minutes after 7:40 PM IST');
      expect(hero.canLetGo, isFalse, reason: 'a paper the server holds is really open');
    });

    test('a start nobody read leads too, says what happened, and can be let go', () {
      final hero = buildToday(ashaInputs(now: _now, openPaper: _pending())).hero! as OpenPaperHero;
      expect(hero.overline, PracticeCopy.pendingOverline);
      expect(hero.line, PracticeCopy.openPendingReason);
      expect(hero.canLetGo, isTrue);
    });

    test('with nothing open the hero is the ordinary move', () {
      expect(buildToday(ashaInputs(now: _now)).hero, isNot(isA<OpenPaperHero>()));
    });
  });

  group('the card', () {
    testWidgets('the key asks for the paper again and, once it is on the phone, opens it', (tester) async {
      final asked = <OpenPaper>[];
      final events = await pump(tester, _held(), onContinue: (p) async {
        asked.add(p);
        return Continued(p.sessionId!);
      });
      expect(find.text('Mock 9, Accountancy'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('open-paper-continue')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(asked, hasLength(1));
      expect(events.whereType<TodayAction>().single.target, isA<GoTo>().having((g) => g.location, 'location', AppRoutes.run('sess-9')));
    });

    testWidgets('a paper the server holds has no "Not now"; a start nobody read has one, and it lets the key go', (tester) async {
      await pump(tester, _held());
      expect(find.byKey(const ValueKey('open-paper-let-go')), findsNothing);

      final gone = <OpenPaper>[];
      await pump(tester, _pending(), letGo: gone);
      await tester.tap(find.byKey(const ValueKey('open-paper-let-go')));
      await tester.pump();
      expect(gone, hasLength(1));
    });

    testWidgets('offline, the card stays and says so in the words of a failed start', (tester) async {
      await pump(tester, _held(), onContinue: (_) async => const ContinueFailed(StartFailure.offline, message: PracticeCopy.openOffline));
      await tester.tap(find.byKey(const ValueKey('open-paper-continue')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Mock 9, Accountancy'), findsOneWidget, reason: 'the card does not go');
      expect(find.byKey(const ValueKey('open-paper-continue')), findsOneWidget);
      expect(find.text(PracticeCopy.openOffline), findsOneWidget);
    });
  });
}
