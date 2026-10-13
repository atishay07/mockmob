import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn/copy.dart';
import 'package:mockmob/features/learn/data/catalog_repository.dart';
import 'package:mockmob/features/learn/data/lesson_loader.dart';
import 'package:mockmob/features/learn/data/pending_event.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/screens/unit_screen.dart';
import 'package:mockmob/features/learn/widgets/due_card.dart';
import 'package:mockmob/features/learn/widgets/run_step.dart';

import '../../golden/learn/golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/learn_fixtures.dart';

class _RunStepHost extends StatelessWidget {
  const _RunStepHost({required this.ui, required this.onRetry});

  final RunUiState ui;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => RunStep(
        ui: ui,
        isLast: false,
        actions: RunStepActions(reveal: () {}, answer: (v, {assisted = false}) {}, rate: (_) {}, advance: () {}, retry: onRetry),
      );
}

/// A catalog notifier that never reaches for the network.
class _FixedCatalog extends LearnCatalogRepository {
  _FixedCatalog(this.refreshed);

  final void Function() refreshed;

  @override
  Future<void> refresh({bool force = false}) async => refreshed();
}

void main() {
  setUpAll(loadAppFonts);

  group('the due card', () {
    for (final due in [1, 12, 123, 1234]) {
      for (final scale in [1.0, 1.3, 2.0]) {
        testWidgets('$due cards due fits a 360 dp phone at ${scale}x text', (tester) async {
          await pumpMockmob(
            tester,
            Padding(
              padding: const EdgeInsets.all(16),
              child: DueCard(queue: StudyQueueView(due: due, newReady: 0, pausedNew: false), recallEnabled: true, onStart: () {}, primary: true),
            ),
            brightness: Brightness.dark,
            textScale: scale,
            disableAnimations: true,
          );
          expect(tester.takeException(), isNull);
          expect(find.text(due == 1 ? 'card due' : 'cards due'), findsOneWidget);
        });
      }
    }
  });

  group('a step with an event waiting on this phone', () {
    final stuckRun = run(item: choiceCard(), revision: 3);

    testWidgets('an answer that could not be sent shows Try again, not a spinner with every key off', (tester) async {
      var retried = 0;
      final pending = PendingEvent.create(expectedRevision: 3, itemId: 'card-2', type: 'answer', value: 1);
      await pumpMockmob(
        tester,
        _RunStepHost(ui: RunUiState(load: RunLoad.ready, run: stuckRun, pending: pending, notice: RunNotice.queuedOffline), onRetry: () => retried++),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.text(LearnCopy.tryAgain), findsOneWidget);
      await tester.tap(find.text(LearnCopy.tryAgain));
      expect(retried, 1);
    });

    testWidgets('a rating queued on a weak signal also offers Try again', (tester) async {
      final r = run(revealed: true, revision: 3, feedback: {'answer': 'Old share'});
      final pending = PendingEvent.create(expectedRevision: 3, itemId: 'card-1', type: 'rate', rating: 3);
      await pumpMockmob(
        tester,
        _RunStepHost(ui: RunUiState(load: RunLoad.ready, run: r, pending: pending, notice: RunNotice.queuedOffline), onRetry: () {}),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.text(LearnCopy.reviewedOffline), findsOneWidget);
      expect(find.text(LearnCopy.tryAgain), findsOneWidget);
    });

    testWidgets('while the event is on its way there is no Try again', (tester) async {
      final pending = PendingEvent.create(expectedRevision: 3, itemId: 'card-2', type: 'answer', value: 1);
      await pumpMockmob(
        tester,
        _RunStepHost(ui: RunUiState(load: RunLoad.ready, run: stuckRun, pending: pending, sending: true), onRetry: () {}),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.text(LearnCopy.tryAgain), findsNothing);
    });
  });

  group('the lesson page after a run', () {
    testWidgets('leaving a run does not read the lesson again, so offline it stays a lesson', (tester) async {
      var lessonReads = 0;
      var catalogRefreshes = 0;
      final lesson = {
        'id': 'acc-sacrifice',
        'title': 'Sacrificing and gaining ratios',
        'subject': 'accountancy',
        'chapter': 'Change in Profit Sharing Ratio',
        'blocks': [readingBlock()],
        'progress': {
          'status': 'in_progress',
          'read': false,
          'inProgress': {'runId': 'run-9', 'step': 3, 'total': 9},
        },
      };
      final router = GoRouter(
        initialLocation: '/learn/acc-sacrifice',
        routes: [
          GoRoute(path: '/learn/acc-sacrifice', builder: (c, s) => const LearnUnitScreen(unitId: 'acc-sacrifice')),
          GoRoute(
            path: '/learn/run/:id',
            builder: (c, s) => Scaffold(body: Center(child: TextButton(onPressed: () => c.pop(), child: const Text('Leave the run')))),
          ),
        ],
      );
      addTearDown(router.dispose);
      tester.view.physicalSize = const Size(720, 1560);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            ...learnOverrides(network: NetworkStatus.online),
            learnCatalogProvider.overrideWith(() => _FixedCatalog(() => catalogRefreshes++)),
            lessonProvider('acc-sacrifice').overrideWith((ref) async {
              lessonReads++;
              return LessonLoad(json: lesson, fromPhone: false);
            }),
          ],
          child: MaterialApp.router(theme: buildTheme(Brightness.dark), routerConfig: router),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(LearnCopy.continueLesson), findsOneWidget);
      expect(lessonReads, 1);

      await tester.tap(find.text(LearnCopy.continueLesson));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text('Leave the run'));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));

      expect(lessonReads, 1, reason: 'a lesson read is a study exposure and must not be repeated for progress');
      expect(catalogRefreshes, 1);
      expect(find.text('Sacrificing and gaining ratios'), findsOneWidget);
      expect(find.text(LearnCopy.unitOfflineTitle), findsNothing);
    });
  });
}
