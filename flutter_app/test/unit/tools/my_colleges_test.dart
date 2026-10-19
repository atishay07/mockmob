// My colleges in the app: the contract the website's route sends (test/fixtures/colleges/
// contract_colleges_v1.json, copied byte for byte from the website), the list rules, the
// controller (optimistic change, revert, full, offline, the copy kept on the phone, the move of
// the older lists) and the widgets that show it.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/my_colleges.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/estimate/estimate.dart' show Reach;
import 'package:mockmob/features/tools/data/my_colleges_actions.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/compass/programme_screen.dart';
import 'package:mockmob/features/tools/data/tools_store.dart';
import 'package:mockmob/features/tools/colleges/colleges_copy.dart';
import 'package:mockmob/features/tools/my_colleges/my_colleges_body.dart';
import 'package:mockmob/features/tools/my_colleges/my_colleges_copy.dart';
import 'package:mockmob/features/tools/my_colleges/my_colleges_sheet.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'my_colleges_support.dart';
import 'tools_test_support.dart';

Map<String, dynamic> _contract() => (jsonDecode(File('test/fixtures/colleges/contract_colleges_v1.json').readAsStringSync()) as Map).cast<String, dynamic>();

void main() {
  setUpAll(loadAppFonts);

  group('the website contract', () {
    final c = _contract();

    test('the file is the contract the app was built for', () {
      expect(c['contract'], 'my-colleges-v1');
      expect(c['path'], '/api/me/colleges');
      expect(c['max'], MyColleges.maxColleges);
      expect(c['ladderSize'], MyColleges.ladderSize);
    });

    test('a list body reads, in order, with places from 1', () {
      final list = MyColleges.fromJson((c['get'] as Map)['body']);
      expect(list.count, 4);
      expect(list.max, 8);
      expect(list.colleges.map((e) => e.position), [1, 2, 3, 4]);
      expect(list.colleges.first.college, 'Shri Ram College of Commerce');
      expect(list.colleges.first.programmeId, 'b-com-hons');
      expect(list.colleges.first.programme, 'B.Com. (Hons.)');
      expect(list.colleges[2].programmeId, 'b-a-hons-economics');
      expect(list.colleges.first.addedAt, DateTime.utc(2026, 10, 16, 5, 30));
      expect(list.ladder.length, 3);
      expect(list.more, 1);
    });

    test('an empty body is an empty list, not a failure', () {
      final list = MyColleges.fromJson(((c['getEmpty'] as Map)['body']));
      expect(list.isEmpty, isTrue);
      expect(list.max, 8);
    });

    test('every success body of the contract reads', () {
      final put = c['put'] as Map;
      expect(MyColleges.fromJson((put['body'] as Map)).count, 3);
      final post = c['post'] as Map;
      expect(MyColleges.fromJson(((post['added'] as Map)['body'])).count, 4);
      expect(MyColleges.fromJson(((post['exists'] as Map)['body'])).count, 4);
      final full = MyColleges.fromJson((((post['full'] as Map)['body'])));
      expect(full.count, 8);
      expect(full.isFull, isTrue);
      expect(MyColleges.fromJson((((c['delete'] as Map)['body']))).count, 3);
    });

    test('what the app sends is what the route accepts', () {
      final put = c['put'] as Map;
      final list = MyColleges.fromJson(put['body']);
      // The request lists the same colleges in the same order, without places or dates.
      expect(list.toPutBody(), put['request']);
      expect(list.colleges.first.toEntry(), (put['request'] as Map)['colleges'].first);
      final post = c['post'] as Map;
      expect(const MyCollege(programmeId: 'b-com-hons', programme: 'B.Com. (Hons.)', college: 'Deshbandhu College').toEntry(), post['request']);
    });

    test('a page that is not the API\'s list never becomes "no colleges"', () {
      expect(() => MyColleges.fromJson('<html>Forbidden</html>'), throwsFormatException);
      expect(() => MyColleges.fromJson(const {'error': 'unavailable'}), throwsFormatException);
    });

    test('the cached copy reads back as the same list', () {
      final list = MyColleges.fromJson(((c['get'] as Map)['body']));
      expect(MyColleges.fromJson(jsonDecode(jsonEncode(list.toJson()))), list);
    });
  });

  test('the copy is plain: no exclamation mark, em dash or middle dot', () {
    final source = File('lib/features/tools/my_colleges/my_colleges_copy.dart').readAsStringSync();
    expect(source.contains('!'), isFalse);
    expect(source.contains('—'), isFalse);
    expect(source.contains('·'), isFalse);
  });

  group('the list rules', () {
    final a = mc('b-com-hons', 'A College', 'B.Com. (Hons.)');
    final b = mc('b-com-hons', 'B College');
    final other = mc('b-com', 'A College');

    test('a college is on the list once for each programme', () {
      final list = const MyColleges().withAdded(a).withAdded(a).withAdded(other);
      expect(list.count, 2);
      expect(list.contains(mc('b-com-hons', 'A College')), isTrue);
      expect(list.colleges.map((e) => e.position), [1, 2]);
    });

    test('the list stops at eight', () {
      var list = const MyColleges();
      for (var i = 0; i < 10; i++) {
        list = list.withAdded(mc('g', 'College $i'));
      }
      expect(list.count, 8);
      expect(list.isFull, isTrue);
    });

    test('removing closes the gap and moving renumbers', () {
      final list = const MyColleges().withAdded(a).withAdded(b).withAdded(other);
      expect(list.withRemoved(b).colleges.map((e) => e.position), [1, 2]);
      expect(list.withMoved(2, 0).colleges.map((e) => e.college), ['A College', 'A College', 'B College']);
      expect(list.withMoved(2, 0).colleges.first.programmeId, 'b-com');
      expect(identical(list.withMoved(0, 9), list), isTrue);
    });
  });

  group('the controller', () {
    late ProviderContainer container;
    late FakeMyColleges fake;
    late MemoryPrefsStore prefs;

    Future<void> start({List<MyCollege> list = const [], ApiError? readError, List<MyCollege>? cached}) async {
      fake = FakeMyColleges(start: list, readError: readError, cached: cached);
      prefs = MemoryPrefsStore();
      container = ProviderContainer(overrides: toolsOverrides(myColleges: fake, prefs: prefs));
      addTearDown(container.dispose);
      container.listen(myCollegesProvider, (_, _) {});
      await _until(() => container.read(myCollegesProvider).status != MyCollegesStatus.loading);
    }

    MyCollegesView view() => container.read(myCollegesProvider);
    MyCollegesActions actions() => container.read(myCollegesActionsProvider.notifier);

    test('it loads the list and keeps it in the student\'s order', () async {
      await start(list: [mc('b-com-hons', 'Hindu College'), mc('b-com-hons', 'Hansraj College')]);
      expect(view().ready, isTrue);
      expect(view().colleges.map((c) => c.college), ['Hindu College', 'Hansraj College']);
      expect(view().stale, isFalse);
      expect(fake.calls, ['GET']);
    });

    test('an add shows at once and is confirmed by the server\'s own answer', () async {
      await start();
      final pending = actions().add(mc('b-com-hons', 'Hindu College', 'B.Com. (Hons.)'));
      expect(view().colleges.single.college, 'Hindu College', reason: 'shown before the server answers');
      expect(await pending, MyCollegesOutcome.saved);
      expect(view().colleges.single.position, 1);
      expect(view().busy, isFalse);
      expect(fake.server.single.college, 'Hindu College');
    });

    test('quick changes run one after another and the order holds', () async {
      await start(list: [mc('g', 'College A'), mc('g', 'College B'), mc('g', 'College C')]);
      final first = actions().move(2, 0);
      final second = actions().remove(mc('g', 'College B'));
      await Future.wait([first, second]);
      expect(view().colleges.map((c) => c.college), ['College C', 'College A']);
      expect(fake.server.map((c) => c.college), ['College C', 'College A']);
      expect(fake.calls.where((c) => c != 'GET'), ['PUT College C|College A|College B', 'DELETE g::College B']);
    });

    test('a change that cannot be sent goes back to what the server confirmed, and says why', () async {
      await start(list: [mc('g', 'College A')]);
      fake.writeError = const ApiError(kind: ApiErrorKind.network, code: 'network');
      final outcome = await actions().add(mc('g', 'College B'));
      expect(outcome, MyCollegesOutcome.offline);
      expect(view().colleges.map((c) => c.college), ['College A']);
      expect(view().notice, MyCollegesCopy.offlineSave);
      expect(view().busy, isFalse);
    });

    test('a failed save is told apart from being offline', () async {
      await start(list: [mc('g', 'College A')]);
      fake.writeError = const ApiError(status: 500, kind: ApiErrorKind.server, code: 'server_error');
      expect(await actions().remove(mc('g', 'College A')), MyCollegesOutcome.failed);
      expect(view().colleges.map((c) => c.college), ['College A'], reason: 'the server never took it off');
      expect(view().notice, MyCollegesCopy.saveFailed);
    });

    test('a full list is refused without a request, in the website\'s words', () async {
      await start(list: [for (var i = 0; i < 8; i++) mc('g', 'College $i')]);
      final before = fake.calls.length;
      expect(await actions().add(mc('g', 'Ninth')), MyCollegesOutcome.full);
      expect(view().colleges.length, 8);
      expect(view().notice, MyCollegesCopy.fullLine);
      expect(fake.calls.length, before);
    });

    test('a full answer from the server shows the server\'s list', () async {
      await start(list: [mc('g', 'College A')]);
      // Another device filled the list after this one loaded.
      fake.server.addAll([for (var i = 0; i < 7; i++) mc('g', 'Other $i')]);
      expect(await actions().add(mc('g', 'Mine')), MyCollegesOutcome.full);
      await _until(() => view().colleges.length == 8);
      expect(view().colleges.any((c) => c.college == 'Mine'), isFalse);
      expect(view().notice, MyCollegesCopy.fullLine);
    });

    test('adding a college that is there already changes nothing and sends nothing', () async {
      await start(list: [mc('g', 'College A')]);
      final before = fake.calls.length;
      expect(await actions().add(mc('g', 'College A')), MyCollegesOutcome.saved);
      expect(fake.calls.length, before);
    });

    test('nothing is sent while the list has not loaded', () async {
      await start(readError: const ApiError(status: 503, kind: ApiErrorKind.unavailable, code: 'unavailable'));
      expect(view().status, MyCollegesStatus.failed);
      expect(await actions().add(mc('g', 'College A')), MyCollegesOutcome.notLoaded);
      expect(fake.calls.where((c) => c.startsWith('POST')), isEmpty);
    });

    test('a list that did not load is a failure, never an empty list', () async {
      await start(readError: const ApiError(kind: ApiErrorKind.network, code: 'network'));
      expect(view().status, MyCollegesStatus.failed);
      expect(view().offline, isTrue);
      expect(view().hasList, isFalse);
      fake.readError = null;
      await actions().retry();
      await _until(() => view().ready);
      expect(view().list.isEmpty, isTrue, reason: 'now the server has said so');
    });

    test('offline with a copy kept on the phone shows the copy and says so', () async {
      await start(readError: const ApiError(kind: ApiErrorKind.network, code: 'network'), cached: [mc('g', 'Kept')]);
      expect(view().ready, isTrue);
      expect(view().colleges.single.college, 'Kept');
      expect(view().stale, isTrue);
      expect(view().offline, isTrue);
    });

    test('the lists kept before are moved onto the account once, in the setup\'s order, and cleared', () async {
      fake = FakeMyColleges(start: [mc('b-com-hons', 'Hindu College', 'B.Com. (Hons.)')]);
      prefs = MemoryPrefsStore();
      await ToolsStore(prefs).saveShortlist('u1', const [ShortlistTarget(groupId: 'b-a-hons-economics', college: 'Hansraj College', programme: 'B.A. (Hons.) Economics')]);
      container = ProviderContainer(overrides: toolsOverrides(myColleges: fake, prefs: prefs));
      addTearDown(container.dispose);
      await container.read(onboardingAnswersProvider.future);
      container.read(onboardingAnswersProvider.notifier)
        ..setCourse('b-com-hons')
        ..toggleCollege('Shri Ram College of Commerce')
        ..toggleCollege('Hindu College');
      container.listen(myCollegesProvider, (_, _) {});
      await _until(() => prefs.values.containsKey(MyCollegesActions.movedKey('u1')));
      expect(fake.server.map((c) => c.college), ['Hindu College', 'Shri Ram College of Commerce', 'Hansraj College']);
      expect(fake.server.last.programmeId, 'b-a-hons-economics');
      expect(await ToolsStore(prefs).shortlist('u1'), isEmpty);

      // A second start never moves them again: a college the student removed stays removed.
      await actions().remove(mc('b-a-hons-economics', 'Hansraj College'));
      final second = ProviderContainer(overrides: toolsOverrides(myColleges: FakeMyColleges(start: fake.server), prefs: prefs));
      addTearDown(second.dispose);
      second.listen(myCollegesProvider, (_, _) {});
      await _until(() => second.read(myCollegesProvider).ready);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(second.read(myCollegesProvider).colleges.any((c) => c.college == 'Hansraj College'), isFalse);
    });

    test("five colleges picked in the setup all reach the account, in order of last year's marks (walk 19 Oct: You said 3)", () async {
      fake = FakeMyColleges();
      prefs = MemoryPrefsStore();
      container = ProviderContainer(overrides: toolsOverrides(myColleges: fake, prefs: prefs));
      addTearDown(container.dispose);
      await container.read(onboardingAnswersProvider.future);
      final answers = container.read(onboardingAnswersProvider.notifier)..setCourse('b-com-hons');
      // The order the walk tapped them: Hansraj, SRCC, Hindu, LSR, Kirori Mal.
      for (final name in ['Hansraj College', 'Shri Ram College of Commerce', 'Hindu College', 'Lady Shri Ram College for Women (W)', 'Kirori Mal College']) {
        answers.toggleCollege(name);
      }
      container.listen(myCollegesProvider, (_, _) {});
      await _until(() => prefs.values.containsKey(MyCollegesActions.movedKey('u1')));
      expect(fake.server.length, 5, reason: 'picks 4 and 5 must not be dropped');
      expect(fake.server.map((c) => c.college), [
        'Shri Ram College of Commerce',
        'Hindu College',
        'Lady Shri Ram College for Women (W)',
        'Hansraj College',
        'Kirori Mal College',
      ]);
      expect(container.read(myCollegesProvider).list.count, 5);
    });
  });

  group('the widgets', () {
    Future<FakeMyColleges> pump(WidgetTester tester, Widget child, {FakeMyColleges? fake}) async {
      final f = fake ?? FakeMyColleges(start: [mc('b-com-hons', 'Hindu College', 'B.Com. (Hons.)'), mc('b-com-hons', 'Hansraj College', 'B.Com. (Hons.)')]);
      await pumpMockmob(
        tester,
        child,
        size: const Size(384, 900),
        wrapInScaffold: true,
        disableAnimations: true,
        overrides: toolsOverrides(myColleges: f),
      );
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      return f;
    }

    testWidgets('the list reads in order with its programme and moves', (tester) async {
      final fake = await pump(tester, const SingleChildScrollView(child: MyCollegesBody(editable: true)));
      expect(find.text('Hindu College'), findsOneWidget);
      expect(find.text('Hansraj College'), findsOneWidget);
      expect(find.text('B.Com. (Hons.)'), findsNWidgets(2));
      expect(tester.getTopLeft(find.text('Hindu College')).dy, lessThan(tester.getTopLeft(find.text('Hansraj College')).dy));

      await tester.tap(find.byTooltip(MyCollegesCopy.moveUp('Hansraj College')));
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      expect(fake.server.map((c) => c.college), ['Hansraj College', 'Hindu College']);
      expect(tester.getTopLeft(find.text('Hansraj College')).dy, lessThan(tester.getTopLeft(find.text('Hindu College')).dy));
    });

    testWidgets('a list that did not load says so and offers Try again, never "no colleges"', (tester) async {
      final fake = FakeMyColleges(readError: const ApiError(kind: ApiErrorKind.network, code: 'network'));
      await pump(tester, const SingleChildScrollView(child: MyCollegesBody()), fake: fake);
      expect(find.text(MyCollegesCopy.failedOffline), findsOneWidget);
      expect(find.text(MyCollegesCopy.empty), findsNothing);
      expect(find.text(MyCollegesCopy.tryAgain), findsOneWidget);

      fake.readError = null;
      await tester.tap(find.text(MyCollegesCopy.tryAgain));
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      expect(find.text(MyCollegesCopy.empty), findsOneWidget, reason: 'the server said it is empty');
    });

    testWidgets('an empty list opens on the chooser; a programme then a college adds it', (tester) async {
      final fake = FakeMyColleges();
      await pump(
        tester,
        Builder(builder: (context) => TextButton(onPressed: () => showMyCollegesSheet(context, adding: true), child: const Text('open'))),
        fake: fake,
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      expect(find.text(CollegesCopy.addTitle), findsOneWidget);

      final sheet = find.byType(MyCollegesSheet);
      // The student types it the way they say it.
      await tester.enterText(find.descendant(of: sheet, matching: find.byType(TextField)), 'bcom hons');
      await tester.pumpAndSettle();
      await tester.tap(find.descendant(of: sheet, matching: find.text('B.Com. (Hons.)')).first);
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
      await tester.pumpAndSettle();
      expect(find.text(CollegesCopy.courseChip('B.Com. (Hons.)')), findsOneWidget);

      await tester.enterText(find.descendant(of: sheet, matching: find.byType(TextField)), 'acharya');
      await tester.pumpAndSettle();
      await tester.tap(find.descendant(of: sheet, matching: find.text('Acharya Narendra Dev College')));
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      expect(fake.server.single.college, 'Acharya Narendra Dev College');
      expect(fake.server.single.programmeId, 'b-com-hons');
      expect(fake.server.single.programme, 'B.Com. (Hons.)');
    });

    testWidgets('Compass names the list in one row, and the row opens it', (tester) async {
      final fake = FakeMyColleges(start: [mc('b-com-hons', 'Hindu College', 'B.Com. (Hons.)')]);
      await pumpMockmob(
        tester,
        const CompassScreen(),
        size: const Size(384, 9000),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics'), myColleges: fake),
      );
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      // The full list lives on the Colleges tab; Compass keeps one row into it (nothing is cut).
      expect(find.text(ToolsCopy.myCollegesRow), findsOneWidget);
      expect(find.text(ToolsCopy.myCollegesRowNote(1, null)), findsOneWidget);
      expect(find.text('Hindu College'), findsNothing);
      await tester.tap(find.text(ToolsCopy.myCollegesRow));
      await tester.pumpAndSettle();
      expect(find.text('Hindu College'), findsOneWidget);
      expect(find.text(MyCollegesCopy.add), findsOneWidget);
    });

    // The real B.Com (Hons.) UR Round 1 figures in the fixture: SRCC 924.3, Hindu 919.9, Hansraj 907.5. LSR has no B.Com (Hons.)
    // seat, so it is left out of the count (no seat is neither safe nor in reach), as on the estimate sheet.
    for (final (low, high, note) in [
      ('900', '920', '4 of 8 · 2 in reach'),
      ('900', '925', '4 of 8 · 3 in reach'),
      ('908', '925', '4 of 8 · 1 safe, 2 in reach'),
      ('930', '930', '4 of 8 · 3 safe'),
      ('800', '850', '4 of 8 · none in reach yet'),
    ]) {
      testWidgets('the Compass row says safe and in reach, in the words of the estimate sheet: $low to $high (verifier M3)', (tester) async {
        final fake = FakeMyColleges(
          start: [
            mc('b-com-hons', 'Shri Ram College of Commerce', 'B.Com. (Hons.)'),
            mc('b-com-hons', 'Hindu College', 'B.Com. (Hons.)'),
            mc('b-com-hons', 'Lady Shri Ram College for Women', 'B.Com. (Hons.)'),
            mc('b-com-hons', 'Hansraj College', 'B.Com. (Hons.)'),
          ],
        );
        final prefs = MemoryPrefsStore()
          ..values['mm.tools.compass.v1'] =
              '{"s":"english,accountancy,business_studies,economics","c":"UR","score":"$low","scoreHigh":"$high"}';
        await pumpMockmob(
          tester,
          const CompassScreen(),
          size: const Size(384, 9000),
          wrapInScaffold: false,
          disableAnimations: true,
          overrides: toolsOverrides(prefs: prefs, myColleges: fake),
        );
        await tester.pumpAndSettle();
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
        await tester.pumpAndSettle();
        expect(find.text(note), findsOneWidget);
        expect(find.textContaining('clear on your estimate'), findsNothing);
      });
    }

    test('the row note names the two words, and says nothing it cannot count', () {
      expect(ToolsCopy.myCollegesRowNote(4, const Reach(safe: 1, inReach: 2, below: 1)), '4 of 8 · 1 safe, 2 in reach');
      expect(ToolsCopy.myCollegesRowNote(4, const Reach(safe: 4)), '4 of 8 · 4 safe');
      expect(ToolsCopy.myCollegesRowNote(4, const Reach(inReach: 3, below: 1)), '4 of 8 · 3 in reach');
      expect(ToolsCopy.myCollegesRowNote(4, const Reach(below: 4)), '4 of 8 · none in reach yet');
      expect(ToolsCopy.myCollegesRowNote(4, const Reach()), '4 of 8', reason: 'no college has a seat for the category');
      expect(ToolsCopy.myCollegesRowNote(4, null), '4 of 8');
    });

    testWidgets('a college row in a cutoff list carries the key, and the key follows the list', (tester) async {
      final fake = FakeMyColleges();
      await pumpMockmob(
        tester,
        const ProgrammeScreen(groupId: 'b-com-hons'),
        size: const Size(384, 9000),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics'), myColleges: fake),
      );
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
      await tester.pumpAndSettle();
      expect(find.text(MyCollegesCopy.addToList), findsWidgets);
      await tester.tap(find.text(MyCollegesCopy.addToList).first);
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      expect(fake.server.length, 1);
      expect(fake.server.single.programmeId, 'b-com-hons');
      expect(find.text(MyCollegesCopy.inList), findsOneWidget);

      await tester.tap(find.text(MyCollegesCopy.inList));
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      expect(fake.server, isEmpty);
      expect(find.text(MyCollegesCopy.inList), findsNothing);
    });

    testWidgets('a key that cannot save says so and the row goes back', (tester) async {
      final fake = FakeMyColleges(writeError: const ApiError(kind: ApiErrorKind.network, code: 'network'));
      await pumpMockmob(
        tester,
        const ProgrammeScreen(groupId: 'b-com-hons'),
        size: const Size(384, 9000),
        wrapInScaffold: true,
        disableAnimations: true,
        overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics'), myColleges: fake),
      );
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
      await tester.pumpAndSettle();
      await tester.tap(find.text(MyCollegesCopy.addToList).first);
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      expect(find.text(MyCollegesCopy.offlineSave), findsOneWidget);
      expect(find.text(MyCollegesCopy.inList), findsNothing);
      expect(fake.server, isEmpty);
    });
  });
}

Future<void> _until(bool Function() done) async {
  for (var i = 0; i < 600 && !done(); i++) {
    await Future<void>.delayed(const Duration(milliseconds: 2));
  }
  expect(done(), isTrue, reason: 'state never settled');
}
