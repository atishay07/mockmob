import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/learn/data/concepts_pick.dart';
import 'package:mockmob/features/learn/data/lesson_loader.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/features/learn/screens/learn_screen.dart';

import '../../helpers/fonts.dart';
import '../../unit/learn/support/learn_fixtures.dart';
import 'golden_support.dart';

/// Open mistakes by chapter: Admission (no lesson yet) costs most, then Change in Profit Sharing Ratio (two lessons).
const _costs = [
  ChapterCost(subject: 'accountancy', chapter: 'Admission of a Partner', open: 3),
  ChapterCost(subject: 'accountancy', chapter: 'Change in Profit Sharing Ratio', open: 2),
];

const _active = {'id': 'run-9', 'mode': 'learn', 'title': 'Goodwill on admission', 'step': 3, 'total': 9, 'unitId': 'acc-goodwill'};

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in Brightness.values) {
    final name = brightness.name;

    testWidgets('learn tab with a run to pick up, $name', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: brightness,
        overrides: learnOverrides(catalog: catalog(due: 12, active: _active), pending: ['run-9']),
      );
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_tab_resume_$name.png'));
    });

    testWidgets('learn tab, due cards and lessons (tall), $name', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: brightness,
        size: const Size(360, 1500),
        overrides: learnOverrides(
          catalog: catalog(due: 12),
          offline: const OfflineLearnState(kept: {'accountancy'}, sizes: {'accountancy': 4404019}),
        ),
      );
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_tab_full_$name.png'));
    });

    testWidgets('learn tab, nothing due and new cards ready, $name', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: brightness,
        overrides: learnOverrides(
          catalog: catalog(due: 0, newCount: 3),
          offline: const OfflineLearnState(kept: {'english'}),
        ),
      );
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_tab_nothing_due_$name.png'));
    });

    testWidgets('learn tab, nothing due at all, $name', (tester) async {
      await pumpScreen(tester, const LearnScreen(), brightness: brightness, overrides: learnOverrides(catalog: catalog(due: 0)));
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_tab_empty_$name.png'));
    });

    testWidgets('learn tab, first visit, Mobi points at how Concepts work, $name', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: brightness,
        overrides: learnOverrides(catalog: catalog(due: 0, newCount: 3), firstVisit: true),
      );
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_tab_first_visit_$name.png'));
    });

    testWidgets('learn tab, no lessons published yet, $name', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: brightness,
        size: const Size(360, 1100),
        overrides: learnOverrides(catalog: LearnCatalog.fromJson({...catalogJson(due: 0), 'units': <Object>[], 'nextUnit': null})),
      );
      await settleSpeech(tester);
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_tab_no_lessons_$name.png'));
    });

    testWidgets('learn tab offline with what was last loaded, $name', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: brightness,
        overrides: learnOverrides(
          catalogState: RemoteState(
            value: catalog(due: 12),
            fetchedAt: DateTime(2026, 10, 12, 18),
            fromCache: true,
            error: const ApiError(kind: ApiErrorKind.network, code: 'network'),
          ),
          network: NetworkStatus.offline,
        ),
      );
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_tab_offline_$name.png'));
    });

    // LEARN-REVIEW-1017 5.9 (P-LR6) at the owner's phone (360 x 800): Read this next from where marks are lost, the
    // concept cards as one row, the search, the subject switch, Where you lose marks.
    testWidgets('learn, read this next from where marks are lost, $name', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: brightness,
        size: const Size(360, 800),
        overrides: learnOverrides(catalog: catalog(due: 4), costs: _costs),
      );
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_marks_$name.png'));
    });

    // The same page, tall: every chapter of the subject, one opened, the record line and the offline switches.
    testWidgets('learn, every chapter with one opened (tall), $name', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: brightness,
        size: const Size(360, 2000),
        overrides: learnOverrides(catalog: catalog(due: 4), costs: _costs),
      );
      await tester.tap(find.text('Change in Profit Sharing Ratio').last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_chapters_$name.png'));
    });

    // A search across subjects.
    testWidgets('learn, a search, $name', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: brightness,
        size: const Size(360, 800),
        overrides: learnOverrides(catalog: catalog(due: 0)),
      );
      await tester.enterText(find.byType(TextField), 'partner');
      await tester.pump(const Duration(milliseconds: 400));
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/learn_search_$name.png'));
    });
  }
}
