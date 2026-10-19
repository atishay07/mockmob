// I11 (owner, 19 Oct): "the name does not save ('Add your name'); Today's 'Good evening' has no name".
//  (a) the hiding rule shows real names (dots, hyphens, spaces) and hides only the email prefix;
//  (b) Today's greeting uses the first name ("Good evening, Atishay");
//  (c) Today asks once for a first name, and its field stays clear of the keyboard;
//  (d) a name saved on You shows at once, on You and in the greeting, before any read back.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/auth/display_name.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/widgets/name_ask.dart';
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

const _fresh = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'atishay@example.com',
  name: 'atishay',
  subjects: ['physics', 'chemistry', 'biology', 'computer_science', 'mathematics'],
);

MockApi _api() {
  final api = MockApi();
  when(() => api.patch(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer((invocation) async {
    final body = invocation.namedArguments[#body] as Map<String, Object?>;
    return ApiResponse(200, {'id': 'u1', ...body});
  });
  return api;
}

/// 7:40 PM IST.
final _evening = DateTime.utc(2026, 10, 20, 14, 10);

String _greetingFor(AuthSnapshot auth) =>
    buildHeader(TodayInputs(now: _evening, firstName: shownFirstName(auth.name, email: auth.email), email: auth.email)).greeting;

void main() {
  group('(a) the rule shows real names and hides only the email prefix', () {
    test('real names with dots, hyphens, apostrophes and spaces show', () {
      expect(shownName('A. Jain', email: 'atishay@example.com'), 'A. Jain');
      expect(shownName('Mary-Ann', email: 'mary@example.com'), 'Mary-Ann');
      expect(shownName("D'Souza", email: 'ds@example.com'), "D'Souza");
      expect(shownName('Atishay Jain', email: 'atishay@example.com'), 'Atishay Jain');
      expect(shownName('Atishay', email: 'atishay@example.com'), 'Atishay', reason: 'typed with a capital; the server never stores one');
      expect(TodayCopy.isHandleName('Mary-Ann'), isFalse);
    });

    test('the email prefix the server stored is hidden', () {
      expect(shownName('atishay', email: 'atishay@example.com'), isNull);
      expect(shownName('asha.verma', email: 'asha.verma@example.com'), isNull);
      expect(shownName('atishay@example.com', email: 'atishay@example.com'), isNull);
    });

    test('the first name is taken after the whole name is checked', () {
      expect(shownFirstName('atishay jain', email: 'atishay@example.com'), 'atishay');
      expect(shownFirstName('atishay', email: 'atishay@example.com'), isNull);
    });
  });

  group('(b) Today greets by first name', () {
    test('"Good evening, Atishay"', () {
      expect(_greetingFor(_fresh), 'Good evening');
      expect(_greetingFor(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'atishay@example.com', name: 'Atishay Jain')), 'Good evening, Atishay');
      expect(_greetingFor(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'mary@example.com', name: 'Mary-Ann Rao')), 'Good evening, Mary-Ann');
    });
  });

  group('(d) saving on You shows at once', () {
    testWidgets('Add your name, save: You and the greeting read the new name with no read back', (tester) async {
      final auth = FakeAuth(_fresh);
      final api = _api();
      await pumpMockmob(tester, const YouHubScreen(), disableAnimations: true, wrapInScaffold: false, size: const Size(360, 2400), overrides: youOverrides(fakeAuth: auth, api: api));
      await tester.pump();
      expect(find.text(YouCopy.sheetNameAdd), findsOneWidget);
      await tester.tap(find.text(YouCopy.sheetNameAdd));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Atishay');
      await tester.pump();
      await tester.tap(find.text('Save name'));
      await tester.pumpAndSettle();
      final body = verify(() => api.patch('/api/users/u1', body: captureAny(named: 'body'), expectUserId: 'u1')).captured.single as Map;
      expect(body, {'name': 'Atishay'});
      // FakeAuth.reload() reads nothing back: what shows is what the server acknowledged.
      expect(find.text('Atishay'), findsWidgets);
      expect(find.text(YouCopy.sheetNameAdd), findsNothing);
      expect(_greetingFor(auth.state), 'Good evening, Atishay');
    });

    testWidgets('the acknowledged name also replaces the cached profile, so a failed read back keeps it', (tester) async {
      final prefs = AppPrefs(MemoryPrefsStore());
      await prefs.setCachedMe('{"user":{"id":"u1","name":"atishay","email":"atishay@example.com","subjects":[]},"needsOnboarding":false}');
      final container = ProviderContainer(overrides: youOverrides(fakeAuth: FakeAuth(_fresh), prefs: prefs));
      addTearDown(container.dispose);
      await container.read(authSnapshotProvider.notifier).acknowledgeName('Atishay');
      expect(container.read(authSnapshotProvider).name, 'Atishay');
      expect(await prefs.cachedMe(), contains('"name":"Atishay"'));
    });
  });

  group('(c) Today asks once for a first name', () {
    Future<(FakeAuth, MockApi, AppPrefs)> pumpAsk(WidgetTester tester, {AuthSnapshot auth = _fresh, AppPrefs? prefs}) async {
      final fake = FakeAuth(auth);
      final api = _api();
      final store = prefs ?? AppPrefs(MemoryPrefsStore());
      await pumpMockmob(
        tester,
        Scaffold(
          body: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: const [SizedBox(height: 420), TodayNameAsk(), SizedBox(height: 40)],
          ),
        ),
        disableAnimations: true,
        wrapInScaffold: false,
        size: const Size(360, 800),
        overrides: youOverrides(fakeAuth: fake, api: api, prefs: store),
      );
      await tester.pumpAndSettle();
      return (fake, api, store);
    }

    testWidgets('the field survives the keyboard, and saving greets by name', (tester) async {
      final (auth, api, prefs) = await pumpAsk(tester);
      expect(find.text(NameAskCopy.title), findsOneWidget);
      final field = find.byKey(const ValueKey('today-name-ask-field'));
      await tester.tap(field);
      await tester.pump();
      // The keyboard opens after the focus: 336 dp of the 800 dp screen.
      tester.view.viewInsets = FakeViewPadding(bottom: 336 * tester.view.devicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();
      await tester.enterText(field, 'Atishay');
      await tester.pumpAndSettle();
      final rect = tester.getRect(field);
      expect(rect.bottom, lessThanOrEqualTo(800 - 336), reason: 'the field is above the keyboard');
      expect(rect.top, greaterThanOrEqualTo(0));
      expect(find.text('Atishay'), findsOneWidget, reason: 'the text survives the resize');
      expect(tester.testTextInput.hasAnyClients, isTrue, reason: 'the field keeps the focus');

      await tester.ensureVisible(find.text(NameAskCopy.save));
      await tester.tap(find.text(NameAskCopy.save));
      await tester.pumpAndSettle();
      verify(() => api.patch('/api/users/u1', body: {'name': 'Atishay'}, expectUserId: 'u1')).called(1);
      expect(auth.state.name, 'Atishay');
      expect(_greetingFor(auth.state), 'Good evening, Atishay');
      expect(find.text(NameAskCopy.title), findsNothing, reason: 'it was a one-time ask');
      expect(await prefs.nameAskDone(), isTrue);
    });

    testWidgets('"Not now" puts it away for good', (tester) async {
      final (_, api, prefs) = await pumpAsk(tester);
      await tester.tap(find.text(NameAskCopy.notNow));
      await tester.pumpAndSettle();
      expect(find.text(NameAskCopy.title), findsNothing);
      expect(await prefs.nameAskDone(), isTrue);
      verifyNever(() => api.patch(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId')));
    });

    testWidgets('never shown when the account already has a name, or once it was put away', (tester) async {
      await pumpAsk(tester, auth: const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'atishay@example.com', name: 'Atishay'));
      expect(find.text(NameAskCopy.title), findsNothing);
      final done = AppPrefs(MemoryPrefsStore());
      await done.setNameAskDone(true);
      await pumpAsk(tester, prefs: done);
      expect(find.text(NameAskCopy.title), findsNothing);
    });
  });
}
