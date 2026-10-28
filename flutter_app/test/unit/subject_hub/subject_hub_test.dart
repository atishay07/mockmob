import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show practiceSubjectsProvider;
import 'package:mockmob/features/subject_hub/subject_hub_content.dart';
import 'package:mockmob/features/subject_hub/subject_hub_copy.dart';
import 'package:mockmob/features/subject_hub/subject_hub_data.dart';
import 'package:mockmob/features/subject_hub/subject_hub_paths.dart';
import 'package:mockmob/features/subject_hub/subject_hub_screen.dart';
import 'package:mockmob/features/subject_hub/subject_hub_widgets.dart' show HubRecordSkeleton;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'hub_support.dart';

void main() {
  setUpAll(loadAppFonts);

  group('content is the website\'s', () {
    test('six hubs, each with its chapters, its approach and its questions', () {
      expect(subjectHubs.map((h) => h.slug), ['english', 'accountancy', 'economics', 'business-studies', 'history', 'political-science']);
      for (final hub in subjectHubs) {
        expect(hub.chapters, isNotEmpty, reason: hub.slug);
        expect(hub.intro, startsWith('CUET '), reason: hub.slug);
        expect(hub.approach.paragraphs, hasLength(2), reason: hub.slug);
        expect(hub.faqs, isNotEmpty, reason: hub.slug);
      }
    });

    test('the website\'s own lines, word for word', () {
      final accountancy = hubContentFor('accountancy')!;
      expect(accountancy.approach.heading, 'Where Accountancy scores are won');
      expect(accountancy.chapters.first, 'Partnership Fundamentals');
      expect(accountancy.chapters, contains('Profit & Loss Appropriation Account'));
      expect(hubContentFor('history')!.chapters, contains('An Imperial Capital — Vijayanagara'));
      expect(hubContentFor('economics')!.chapters, contains('Indian Economic Development 1950–1990'));
      expect(
        pyqGuide.intro,
        'Learn how to use CUET previous year questions to study exam patterns and review your preparation. MockMob does not '
        'currently claim a verified historical question inventory; its ordinary practice content is not presented as '
        'official past-paper material.',
      );
    });

    test('the one answer that points at the website\'s home page is left out', () {
      final english = hubContentFor('english')!;
      expect(english.faqs.map((f) => f.question), isNot(contains('Can I practise CUET English free on MockMob?')));
      for (final hub in subjectHubs) {
        for (final f in hub.faqs) {
          expect(f.answer, isNot(contains('home page')));
        }
      }
    });

    test('the previous-year guide has its four sections and four questions', () {
      expect(pyqGuide.sections.map((s) => s.heading), [
        'Why CUET previous year questions are important',
        'How to practise CUET PYQs correctly',
        'Using MockMob with previous year questions',
        'PYQ strategy for higher CUET scores',
      ]);
      expect(pyqGuide.faqs, hasLength(4));
    });

    test('an id of any spelling finds its hub', () {
      expect(hubSubjectId('business-studies'), 'business_studies');
      expect(hubSubjectId(' Political-Science '), 'political_science');
      expect(hubSubjectId('business'), 'business_studies');
      expect(hubContentFor('business-studies')!.name, 'Business Studies');
      expect(hubContentFor('physics'), isNull);
    });
  });

  group('paths', () {
    test('the hub, practice and a chapter', () {
      expect(SubjectHubPaths.of('business_studies'), '/practice/subject/business_studies');
      expect(SubjectHubPaths.practise('accountancy'), '/practice/setup/quick?subject=accountancy');
      final chapter = Uri.parse(SubjectHubPaths.practiseChapter('economics', 'Money & Banking'));
      expect(chapter.path, '/practice/setup/chapter');
      expect(chapter.queryParameters, {'subject': 'economics', 'chapter': 'Money & Banking'});
    });

    test('a website subject link opens the hub, any other website path does not', () {
      expect(SubjectHubPaths.fromWebPath('/cuet/business-studies'), '/practice/subject/business_studies');
      expect(SubjectHubPaths.fromWebPath('/cuet/accountancy/'), '/practice/subject/accountancy');
      expect(SubjectHubPaths.fromWebPath('/cuet-2027'), isNull);
      expect(SubjectHubPaths.fromWebPath('/cuet'), isNull);
      expect(SubjectHubPaths.fromWebPath('/cuet/a/b'), isNull);
    });

    test('the template matches the full path', () {
      expect(SubjectHubPaths.fullTemplate, '/practice/subject/:subject');
      expect(SubjectHubPaths.template, 'subject/:subject');
    });
  });

  group('the record', () {
    final chapters = hubContentFor('accountancy')!.chapters;
    final record = buildSubjectRecord(attempts: accountancyAttempts(), subjectIds: {'accountancy'}, chapters: chapters);

    test('counts only this subject\'s attempts, with the span they cover', () {
      expect(record.attempts, 2);
      expect(record.correct, 14);
      expect(record.wrong, 9);
      expect(record.answered, 23);
      expect(record.lastAt, DateTime.utc(2026, 10, 12, 9));
      expect(record.hasChapterDetail, isTrue);
    });

    test('counts each chapter from the questions it carries', () {
      final partnership = record.chapters['Partnership Fundamentals']!;
      expect((partnership.correct, partnership.wrong, partnership.answered), (9, 3, 12));
      expect(partnership.percent, 75);
      final goodwill = record.chapters['Goodwill Valuation']!;
      expect((goodwill.correct, goodwill.answered), (3, 8));
      expect(goodwill.percent, 38);
    });

    test('a percentage needs five answers; fewer are a count and nothing sharper', () {
      final ratios = record.chapters['Accounting Ratios']!;
      expect((ratios.correct, ratios.answered), (2, 3));
      expect(ratios.percent, isNull);
      expect(ratios.fraction, closeTo(2 / 3, 1e-9));
    });

    test('blank questions are not wrong answers, and an untouched chapter is not zero', () {
      final cash = record.chapters['Cash Flow Statement']!;
      expect((cash.answered, cash.blank, cash.seen), (0, 2, true));
      expect(cash.fraction, isNull);
      final untouched = record.chapters['Debentures']!;
      expect(untouched.seen, isFalse);
      expect(untouched.percent, isNull);
    });

    test('a question of a chapter the list does not name is left out of the rows, not the total', () {
      final odd = buildSubjectRecord(
        attempts: [hubAttempt('x', 'accountancy', [...rowsOf('Unmapped chapter', right: 3), ...rowsOf('Debentures', right: 1)])],
        subjectIds: {'accountancy'},
        chapters: chapters,
      );
      expect(odd.answered, 4);
      expect(odd.chapters['Debentures']!.answered, 1);
      expect(odd.chapters.values.fold<int>(0, (n, c) => n + c.answered), 1);
    });

    test('case and spacing of a chapter name do not split it', () {
      final r = buildSubjectRecord(
        attempts: [hubAttempt('y', 'accountancy', rowsOf('  goodwill   VALUATION ', right: 2, wrong: 1))],
        subjectIds: {'accountancy'},
        chapters: chapters,
      );
      expect(r.chapters['Goodwill Valuation']!.answered, 3);
    });

    test('attempts held without their questions are never read as "no answers" in a chapter', () {
      final bare = Attempt.fromJson({
        'id': 'b',
        'subject': 'accountancy',
        'score': 0,
        'correct': 6,
        'wrong': 2,
        'unattempted': 2,
        'total': 10,
        'completedAt': DateTime.utc(2026, 10, 11).toIso8601String(),
      });
      final r = buildSubjectRecord(attempts: [bare], subjectIds: {'accountancy'}, chapters: chapters);
      expect(r.attempts, 1);
      expect((r.correct, r.answered), (6, 8));
      expect(r.hasChapterDetail, isFalse);
    });

    test('no attempt in the subject is the empty record, and the attempt-side id counts', () {
      expect(buildSubjectRecord(attempts: accountancyAttempts(), subjectIds: {'economics'}, chapters: chapters).attempts, 0);
      final gat = buildSubjectRecord(
        attempts: [hubAttempt('g', 'gat', rowsOf('Quantitative Reasoning', right: 5))],
        subjectIds: {'general_test', 'gat'},
        chapters: const ['Quantitative Reasoning'],
      );
      expect(gat.attempts, 1);
    });
  });

  group('the chapters to list', () {
    ProviderContainer container({List<Subject> subjects = const []}) {
      final c = ProviderContainer(overrides: hubOverrides(subjects: subjects));
      addTearDown(c.dispose);
      return c;
    }

    test('the website\'s own list until the subject list reads', () async {
      final c = container();
      expect(c.read(subjectHubChaptersProvider('accountancy')), hubContentFor('accountancy')!.chapters);
    });

    test('the live list wins once it has chapters (practice takes the names from there)', () async {
      final c = container(
        subjects: const [Subject(id: 'accountancy', internalId: 'accountancy', name: 'Accountancy', chapters: ['Live one', 'Live two'], practice: 'supported')],
      );
      c.listen(subjectHubChaptersProvider('accountancy'), (_, _) {});
      await c.read(practiceSubjectsProvider.future);
      expect(c.read(subjectHubChaptersProvider('accountancy')), ['Live one', 'Live two']);
    });

    test('a subject with no hub and no live chapters has none', () {
      final c = container();
      expect(c.read(subjectHubChaptersProvider('physics')), isEmpty);
    });
  });

  group('the screen', () {
    Future<GoRouter> pumpHub(WidgetTester tester, {required RemoteState<List<Attempt>> attempts, String subject = 'accountancy', Brightness brightness = Brightness.dark, Size size = const Size(390, 2400)}) async {
      final router = GoRouter(
        initialLocation: '/hub',
        routes: [
          GoRoute(path: '/hub', builder: (c, s) => SubjectHubScreen(subject: subject)),
          GoRoute(path: '/practice', builder: (c, s) => const Scaffold(body: Text('AT practice'))),
          GoRoute(path: '/practice/setup/:mode', builder: (c, s) => const Scaffold(body: Text('AT setup'))),
        ],
      );
      addTearDown(router.dispose);
      tester.view.physicalSize = size * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: hubOverrides(attempts: attempts),
          child: MaterialApp.router(
            debugShowCheckedModeBanner: false,
            theme: buildTheme(brightness),
            routerConfig: router,
            builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
          ),
        ),
      );
      await settleImages(tester);
      await tester.pumpAndSettle();
      return router;
    }

    testWidgets('the record, the one key and the chapters carry the student\'s own numbers', (tester) async {
      await pumpHub(tester, attempts: loaded(accountancyAttempts()));
      expect(find.text('14 of 23 answers right'), findsOneWidget);
      expect(find.text('From 2 attempts, the last on 12 Oct.'), findsOneWidget);
      expect(find.text('Practise Accountancy'), findsOneWidget);
      expect(find.text('Partnership Fundamentals'), findsOneWidget);
      expect(find.text('9 of 12 right'), findsOneWidget);
      expect(find.text('75%'), findsOneWidget);
      expect(find.text('38%'), findsOneWidget);
      expect(find.text('2 of 3 right. Too few to rate'), findsOneWidget);
      expect(find.text('No answers, 2 questions left blank'), findsOneWidget);
    });

    testWidgets('a student with no attempt here is told so, and no chapter is called unpractised', (tester) async {
      await pumpHub(tester, attempts: loaded(const []));
      expect(find.text('Not practised yet'), findsOneWidget);
      expect(find.text('No answers yet'), findsNothing);
      expect(find.text('Goodwill Valuation'), findsOneWidget);
    });

    testWidgets('the failed read says so, keeps the syllabus and retries', (tester) async {
      FakeHubAttempts.refreshes = 0;
      await pumpHub(tester, attempts: const RemoteState(error: offlineError));
      expect(find.text('Your answers could not be read'), findsOneWidget);
      expect(find.text('Goodwill Valuation'), findsOneWidget);
      await tester.tap(find.text('Try again'));
      await tester.pump();
      expect(FakeHubAttempts.refreshes, 1);
    });

    testWidgets('a saved copy shown after a failed read says when it is from', (tester) async {
      await pumpHub(tester, attempts: RemoteState(value: accountancyAttempts(), fetchedAt: DateTime(2026, 10, 15, 21, 40), error: offlineError));
      expect(find.textContaining('Saved copy from 9:40 PM.'), findsOneWidget);
      expect(find.text('14 of 23 answers right'), findsOneWidget);
    });

    testWidgets('the first read shows the shape of the text, not a zero', (tester) async {
      final router = GoRouter(routes: [GoRoute(path: '/', builder: (c, s) => const SubjectHubScreen(subject: 'accountancy'))]);
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: hubOverrides(attempts: const RemoteState(loading: true)),
          child: MaterialApp.router(theme: buildTheme(Brightness.light), routerConfig: router),
        ),
      );
      await tester.pump();
      expect(find.text('Not practised yet'), findsNothing);
      expect(find.byType(HubRecordSkeleton), findsOneWidget);
    });

    testWidgets('the primary key practises the subject through setup; a chapter row practises the chapter', (tester) async {
      final router = await pumpHub(tester, attempts: loaded(accountancyAttempts()));
      await tester.tap(find.text('Practise Accountancy'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/practice/setup/quick');
      expect(router.state.uri.queryParameters['subject'], 'accountancy');
      router.pop();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Goodwill Valuation'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/practice/setup/chapter');
      expect(router.state.uri.queryParameters, {'subject': 'accountancy', 'chapter': 'Goodwill Valuation'});
    });

    testWidgets('a guide section opens in place and closes again', (tester) async {
      await pumpHub(tester, attempts: loaded(const []), size: const Size(390, 844));
      final heading = find.text('How to practise CUET PYQs correctly');
      await tester.scrollUntilVisible(heading, 300, scrollable: find.byType(Scrollable).first);
      expect(find.textContaining('Start by solving a set without looking at explanations.'), findsNothing);
      await tester.tap(heading);
      await tester.pumpAndSettle();
      expect(find.textContaining('Start by solving a set without looking at explanations.'), findsOneWidget);
      await tester.tap(heading);
      await tester.pumpAndSettle();
      expect(find.textContaining('Start by solving a set without looking at explanations.'), findsNothing);
    });

    testWidgets('a subject the website has no hub for still opens: object, key, chapters line and the guide', (tester) async {
      await pumpHub(tester, attempts: loaded(const []), subject: 'physics');
      expect(find.text('Practise Physics'), findsOneWidget);
      expect(find.text('Chapters are not loaded yet'), findsOneWidget);
      expect(find.text('Previous-year questions'), findsWidgets);
    });

    testWidgets('the website\'s slug opens the same hub', (tester) async {
      await pumpHub(tester, attempts: loaded(const []), subject: 'business-studies');
      expect(find.text('Practise Business Studies'), findsOneWidget);
      expect(find.text('Nature & Significance of Management'), findsOneWidget);
    });

    testWidgets('large text and the longest chapter name stay inside the screen', (tester) async {
      tester.view.physicalSize = const Size(390, 844) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final router = GoRouter(routes: [GoRoute(path: '/', builder: (c, s) => const SubjectHubScreen(subject: 'economics'))]);
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: hubOverrides(attempts: loaded(const [])),
          child: MaterialApp.router(
            theme: buildTheme(Brightness.light),
            routerConfig: router,
            builder: (context, app) => MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.6), disableAnimations: true),
              child: app!,
            ),
          ),
        ),
      );
      await settleImages(tester);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Introduction & Theory of Consumer Behaviour'), findsOneWidget);
    });
  });
}
