import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/connectivity/connectivity_monitor.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/data/practice_quote.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/runner/nta/nta_instructions_parts.dart';
import 'package:mockmob/features/runner/nta/nta_instructions_screen.dart';
import 'package:mockmob/features/runner/nta/nta_integrity.dart';
import 'package:mockmob/features/runner/nta/nta_runner_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;
import 'support/harness.dart' show kRunnerSize;

class _Online extends NetworkStatusNotifier {
  @override
  NetworkStatus build() => NetworkStatus.online;
}

class _Starter implements PracticeStarting {
  final List<PracticeQuote?> starts = [];

  @override
  Future<StartOutcome> start(PracticeSelection selection, {PracticeQuote? quote, int? mockNumber}) async {
    starts.add(quote);
    return const Started('sess-9');
  }
}

final DateTime _now = DateTime.utc(2026, 10, 14, 9);

PracticeQuote _quote({required int cost, required DateTime expiresAt}) => PracticeQuote.fromJson({
  'state': 'available',
  'launchable': true,
  'reasonCode': 'included',
  'count': 50,
  'durationSec': 3600,
  'creditCost': cost,
  'creditBalance': 10,
  'expiresAt': expiresAt.toIso8601String(),
});

/// Start after the quote expired, when the fresh quote is open but dearer (bug hunt
/// runner-nta-04): the page must say what it costs now, start nothing, and take the next Start
/// as the yes to that cost.
void main() {
  setUpAll(loadAppFonts);

  Future<(_Starter, GoRouter)> pump(WidgetTester tester, List<PracticeQuote> quotes) async {
    tester.view.physicalSize = kRunnerSize * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final starter = _Starter();
    final router = GoRouter(
      initialLocation: '/exam/nta',
      routes: [
        GoRoute(path: '/exam/nta', builder: (context, state) => const NtaInstructionsScreen(subject: 'accountancy')),
        GoRoute(path: '/run/:id', builder: (context, state) => Text('AT ${state.uri}')),
        GoRoute(path: '/practice', builder: (context, state) => const Text('AT /practice')),
      ],
    );
    addTearDown(router.dispose);
    var served = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ntaCandidateNameProvider.overrideWithValue('Asha Verma'),
          ntaPrefsProvider.overrideWithValue(MemoryPrefsStore()),
          networkStatusProvider.overrideWith(_Online.new),
          nowProvider.overrideWithValue(() => _now),
          practiceQuoteProvider.overrideWith((ref, query) async => quotes[(served++).clamp(0, quotes.length - 1)]),
          practiceStarterProvider.overrideWithValue(starter),
          practiceSubjectsProvider.overrideWith((ref) async => const []),
          completedMockCountProvider.overrideWith((ref, subject) async => 0),
        ],
        child: DefaultAssetBundle(
          bundle: FileAssetBundle(),
          child: MaterialApp.router(theme: buildTheme(Brightness.light), routerConfig: router),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.ensureVisible(find.text(NtaStartCopy.declare));
    await tester.tap(find.text(NtaStartCopy.declare));
    await tester.pump(const Duration(milliseconds: 200));
    return (starter, router);
  }

  Future<void> start(WidgetTester tester) async {
    await tester.tap(find.text(NtaStartCopy.start));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets('a dearer fresh quote shows the new cost and starts nothing', (tester) async {
    final expired = _quote(cost: 1, expiresAt: _now.subtract(const Duration(seconds: 5)));
    final dearer = _quote(cost: 3, expiresAt: _now.add(const Duration(seconds: 60)));
    final (starter, _) = await pump(tester, [expired, dearer]);

    await start(tester);
    expect(starter.starts, isEmpty, reason: 'nothing starts on a cost the student has not seen');
    expect(find.textContaining('This changed while you were here.'), findsOneWidget);
    expect(find.textContaining('3 credits'), findsOneWidget);
    expect(find.text(PracticeCopy.unavailableFallback), findsNothing, reason: 'the paper is open, it only costs more');
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('the next Start is the yes to the new cost', (tester) async {
    final expired = _quote(cost: 1, expiresAt: _now.subtract(const Duration(seconds: 5)));
    final dearer = _quote(cost: 3, expiresAt: _now.add(const Duration(seconds: 60)));
    final (starter, router) = await pump(tester, [expired, dearer]);

    await start(tester);
    await start(tester);
    expect(starter.starts, hasLength(1));
    expect(starter.starts.single?.creditCost, 3);
    expect(router.routerDelegate.currentConfiguration.uri.toString(), '/run/sess-9');
  });
}
