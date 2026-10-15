// ignore_for_file: depend_on_referenced_packages
// Feature wave 15 Oct, K0: the contract every wave 2 packet builds on. The four new routes
// resolve (natively and from the website's links), each slot sits in its host screen in the
// planned place, and a slot that is still K0's placeholder draws nothing at all.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/action_router.dart';
import 'package:mockmob/core/router/router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/chapters/screens/chapters_screen.dart';
import 'package:mockmob/features/chapters/widgets/practice_link.dart';
import 'package:mockmob/features/chapters/widgets/record_row.dart';
import 'package:mockmob/features/formats/widgets/formats_card.dart';
import 'package:mockmob/features/formats/widgets/formats_row.dart';
import 'package:mockmob/features/leaks/widgets/leak_card.dart';
import 'package:mockmob/features/revise/screens/revise_screen.dart';
import 'package:mockmob/features/revise/widgets/revise_section.dart';
import 'package:mockmob/features/rhythm/week_review/week_review_screen.dart';
import 'package:mockmob/features/rulebook/screens/rulebook_screen.dart';

ActionTarget _go(String href) => ActionRouter.resolve(href);

/// The source of a file of this package (tests run with the package root as the working directory).
String _source(String path) => File(path).readAsStringSync();

/// Each anchor appears in [source], in this order.
void _expectInOrder(String source, List<String> anchors, {required String file}) {
  var from = -1;
  for (final anchor in anchors) {
    final at = source.indexOf(anchor, from + 1);
    expect(at, greaterThan(from), reason: '$file: "$anchor" should come after the previous anchor');
    from = at;
  }
}

class _Auth extends Notifier<AuthSnapshot> {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');
}

final _testAuth = NotifierProvider<_Auth, AuthSnapshot>(_Auth.new);

void main() {
  group('routes', () {
    test('the four new templates are native and not auth paths', () {
      for (final path in ['/review/revise', '/practice/chapters/accountancy', '/review/rules', '/today/week-review']) {
        expect(AppRoutes.isNativePath(path), isTrue, reason: path);
        expect(AppRoutes.isAuthPath(path), isFalse, reason: path);
      }
      expect(AppRoutes.templates, containsAll(<String>[AppRoutes.reviewRevise, '/practice/chapters/:subject', AppRoutes.reviewRules, AppRoutes.todayWeekReview]));
      expect(AppRoutes.practiceChapters('business_studies'), '/practice/chapters/business_studies');
      expect(AppRoutes.todayWeekReviewOf('2026-10-12'), '/today/week-review?week=2026-10-12');
    });

    test('website links open the native screens', () {
      expect(_go('/review/revise'), const NativeTarget('/review/revise'));
      expect(_go('https://www.mockmob.in/review/revise'), const NativeTarget('/review/revise'));
      expect(_go('/review/rules'), const NativeTarget('/review/rules'));
      expect(_go('https://www.mockmob.in/review/rules?x=1'), const NativeTarget('/review/rules'));

      expect(_go('/practice/chapters?subject=accountancy'), const NativeTarget('/practice/chapters/accountancy'));
      expect(_go('/dashboard/chapters?subject=business_studies'), const NativeTarget('/practice/chapters/business_studies'));
      expect(_go('https://www.mockmob.in/practice/chapters?subject=economics'), const NativeTarget('/practice/chapters/economics'));
      expect(_go('/practice/chapters/accountancy'), const NativeTarget('/practice/chapters/accountancy'));
      expect(_go('/practice/chapters'), const NativeTarget('/practice'), reason: 'no subject: Practice, where the link lives');

      expect(_go('/today?sheet=week-review'), const NativeTarget('/today/week-review'));
      expect(_go('/today?sheet=week-review&week=2026-10-12'), const NativeTarget('/today/week-review?week=2026-10-12'));
      expect(_go('/today/week-review?week=2026-10-12&x=1'), const NativeTarget('/today/week-review?week=2026-10-12'));
      expect(_go('/today?sheet=week-review&week=last'), const NativeTarget('/today/week-review'));
      expect(_go('/today?sheet=other'), const NativeTarget('/today'));
    });

    test('a malformed subject never becomes a path', () {
      for (final bad in ['/practice/chapters?subject=..', '/practice/chapters?subject=a.b', '/dashboard/chapters?subject=a%2Fb', '/practice/chapters/a.b']) {
        expect(_go(bad), const UnsupportedTarget(), reason: bad);
      }
      // An escaped slash makes it some other page of the site: never a native screen.
      expect(_go('/practice/chapters/a%2F..'), isNot(isA<NativeTarget>()));
    });

    test('the practice setup carries a known format and drops any other', () {
      expect(_go('/dashboard?mode=quick&count=5&format=sequence'), const NativeTarget('/practice/setup/quick?count=5&format=sequence'));
      expect(
        _go('/dashboard?mode=quick&subject=accountancy&count=5&format=match'),
        const NativeTarget('/practice/setup/quick?subject=accountancy&count=5&format=match'),
      );
      expect(_go('/practice/start?mode=quick&format=statements'), const NativeTarget('/practice/start?mode=quick&format=statements'));
      expect(_go('/practice/setup/quick?format=assertion_reason'), const NativeTarget('/practice/setup/quick?format=assertion_reason'));
      for (final f in ['numerical', 'plain']) {
        expect(_go('/dashboard?mode=quick&format=$f'), NativeTarget('/practice/setup/quick?format=$f'), reason: f);
      }
      expect(_go('/dashboard?mode=quick&format=nonsense'), const NativeTarget('/practice/setup/quick'));
      expect(_go('/dashboard?mode=quick&format=SEQUENCE'), const NativeTarget('/practice/setup/quick'));
    });

    testWidgets('each new route opens its screen in the real router', (tester) async {
      SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.empty();
      tester.view.physicalSize = const Size(720, 1560);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final container = ProviderContainer(
        overrides: <Override>[
          authSnapshotProvider.overrideWithBuild((ref, notifier) => ref.watch(_testAuth)),
          appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
        ],
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: Consumer(
            builder: (context, ref, _) => MaterialApp.router(
              debugShowCheckedModeBanner: false,
              theme: buildTheme(Brightness.light),
              routerConfig: ref.watch(routerProvider),
            ),
          ),
        ),
      );
      Future<void> settle() async {
        for (var i = 0; i < 6; i++) {
          await tester.pump(const Duration(milliseconds: 150));
        }
      }

      await settle();
      final router = container.read(routerProvider);
      final cases = <String, Type>{
        '/review/revise': ReviseScreen,
        '/practice/chapters/accountancy': ChaptersScreen,
        '/review/rules': RuleBookScreen,
        '/today/week-review?week=2026-10-12': WeekReviewScreen,
      };
      for (final MapEntry(key: path, value: type) in cases.entries) {
        router.go(path);
        await settle();
        expect(router.routerDelegate.currentConfiguration.uri.toString(), path);
        expect(find.byType(type), findsOneWidget, reason: path);
        expect(tester.takeException(), isNull, reason: path);
        if (type == ChaptersScreen) expect(tester.widget<ChaptersScreen>(find.byType(ChaptersScreen)).subjectId, 'accountancy');
        if (type == WeekReviewScreen) expect(tester.widget<WeekReviewScreen>(find.byType(WeekReviewScreen)).weekStart, '2026-10-12');
      }

      // Unmount and let the real screens' timers run out.
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 10));
    });
  });

  group('slots', () {
    test('Your record: chapters row, the Chapters section, formats, then leaks', () {
      const file = 'lib/features/insights/screens/insights_screen.dart';
      _expectInOrder(
        _source(file),
        ['const ChaptersRecordRow()', 'InsightsCopy.chaptersHeading', 'const FormatsCard()', 'const LeakCard()'],
        file: file,
      );
    });

    test('Review: Revise sits above Past results', () {
      const file = 'lib/features/review/screens/review_screen.dart';
      _expectInOrder(_source(file), ['ReviewCopy.recordHeading', 'const ReviseSection()', 'ReviewCopy.pastHeading'], file: file);
    });

    test('Practice: the chapters link under the tiles, the formats row in Choose your own', () {
      const file = 'lib/features/practice/practice_screen.dart';
      _expectInOrder(
        _source(file),
        ['SubjectTiles(', 'ChaptersLink(subjectId: subject)', 'ChoiceDeck(', 'FormatsRow(subjectId: subject)', 'PracticeMoreRows('],
        file: file,
      );
    });

    // Once a packet replaces its placeholder (and drops the "K0 placeholder" line), its own tests
    // own what it draws; until then the slot must change nothing on the page.
    final slots = <String, Widget>{
      'lib/features/chapters/widgets/record_row.dart': const ChaptersRecordRow(),
      'lib/features/chapters/widgets/practice_link.dart': const ChaptersLink(subjectId: 'accountancy'),
      'lib/features/formats/widgets/formats_card.dart': const FormatsCard(),
      'lib/features/formats/widgets/formats_row.dart': const FormatsRow(subjectId: 'accountancy'),
      'lib/features/leaks/widgets/leak_card.dart': const LeakCard(),
      'lib/features/revise/widgets/revise_section.dart': const ReviseSection(),
    };
    for (final MapEntry(key: file, value: slot) in slots.entries) {
      testWidgets('${slot.runtimeType} builds, and draws nothing while it is a placeholder', (tester) async {
        await tester.pumpWidget(
          ProviderScope(
            child: MaterialApp(
              theme: buildTheme(Brightness.light),
              // A column, not a list: a list treats a zero-height child as off screen.
              home: Scaffold(body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [slot])),
            ),
          ),
        );
        expect(tester.takeException(), isNull);
        expect(find.byType(slot.runtimeType), findsOneWidget);
        if (_source(file).contains('K0 placeholder')) {
          expect(tester.getSize(find.byType(slot.runtimeType)).height, 0, reason: file);
        }
        await tester.pumpWidget(const SizedBox());
        await tester.pump(const Duration(seconds: 1));
      });
    }
  });
}
