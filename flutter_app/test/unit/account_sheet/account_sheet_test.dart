import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart' show sessionDraftRepositoryProvider;
import 'package:mockmob/core/settings/appearance_settings.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/sync/outbox_repository.dart' show outboxRepositoryProvider;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/account/account_avatar.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/account_sheet/account_copy.dart';
import 'package:mockmob/features/account_sheet/account_sheet.dart';
import 'package:mockmob/features/you/you_providers.dart';

import '../you/you_test_support.dart' show draftsWithUnsent, outboxWith;

const _asha = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  name: 'Asha Verma',
  email: 'asha@example.com',
  creditBalance: 24,
);

class _Mailer implements SupportMailer {
  _Mailer({this.composes = true});

  final bool composes;
  int composed = 0;

  @override
  Future<bool> compose() async {
    composed++;
    return composes;
  }

  @override
  Future<void> copyAddress() async {}
}

/// A tab root with the shared header, and a stub page for every path the sheet can open.
Future<void> _pumpApp(WidgetTester tester, {_Mailer? mailer, AuthSnapshot auth = _asha, List<Override> extra = const []}) async {
  tester.view.physicalSize = const Size(360, 780) * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  GoRoute stub(String path) => GoRoute(path: path, builder: (context, state) => Scaffold(body: Text('page $path')));
  final router = GoRouter(
    initialLocation: '/tab',
    routes: [
      GoRoute(
        path: '/tab',
        builder: (context, state) => const Scaffold(
          body: SafeArea(
            child: Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: TabRootHeader(title: 'Practice')),
          ),
        ),
      ),
      stub(AccountSheetPaths.account),
      stub(AccountSheetPaths.notifications),
      stub(AccountSheetPaths.studyDays),
      stub(AccountSheetPaths.privacy),
      stub(AccountSheetPaths.help),
      stub(AccountSheetPaths.ask),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authSnapshotProvider.overrideWithBuild((ref, n) => auth),
        creditsRepositoryProvider.overrideWithBuild(
          (ref, n) => RemoteState(value: AiCredits(state: 'available', wallet: AiWallet(known: true, spendable: 18, resetAt: DateTime(2026, 11, 1)))),
        ),
        appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
        supportMailerProvider.overrideWithValue(mailer ?? _Mailer()),
        ...extra,
      ],
      child: Consumer(
        builder: (context, ref, _) => MaterialApp.router(
          routerConfig: router,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: ref.watch(themeModeProvider),
          // Mobi and the sheet hold still, so every frame settles.
          builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: child!),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _openSheet(WidgetTester tester) async {
  await tester.tap(find.byType(AccountAvatarButton));
  await tester.pumpAndSettle();
}

void main() {
  test('the initial is the first letter of the name, then of the email', () {
    expect(accountInitial('asha verma', 'x@y.in'), 'A');
    expect(accountInitial(null, 'riya@y.in'), 'R');
    expect(accountInitial('  ', null), isNull);
    expect(accountInitial(null, null), isNull);
  });

  testWidgets('the avatar on the tab root opens the Account sheet', (tester) async {
    await _pumpApp(tester);
    expect(find.text('A'), findsOneWidget);
    expect(find.byType(AccountSheet), findsNothing);
    final box = tester.getSize(find.byType(AccountAvatar));
    expect(box, const Size(40, 40));

    await _openSheet(tester);
    expect(find.byType(AccountSheet), findsOneWidget);
    expect(find.text('Asha Verma'), findsOneWidget);
    expect(find.text('asha@example.com'), findsOneWidget);
    expect(find.text(AccountCopy.planFree), findsOneWidget);
    // Both ledgers, each with its meaning.
    expect(find.text('24'), findsOneWidget);
    expect(find.text(AccountCopy.practiceMeaning), findsOneWidget);
    expect(find.text('18'), findsOneWidget);
    expect(find.text(AccountCopy.aiMeaning), findsOneWidget);
    expect(find.text(AccountCopy.aiRenews('1 November')), findsOneWidget);
  });

  testWidgets('the avatar answers a finger anywhere in 48 dp', (tester) async {
    await _pumpApp(tester);
    final centre = tester.getCenter(find.byType(AccountAvatar));
    await tester.tapAt(centre + const Offset(23, 0));
    await tester.pumpAndSettle();
    expect(find.byType(AccountSheet), findsOneWidget);
  });

  testWidgets('a balance that did not load is never shown as zero', (tester) async {
    await _pumpApp(tester, auth: const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Asha'));
    await _openSheet(tester);
    expect(find.text('0'), findsNothing);
    expect(find.text(AccountCopy.notLoaded), findsOneWidget);
  });

  testWidgets('the appearance switch changes the theme at once', (tester) async {
    await _pumpApp(tester);
    await _openSheet(tester);
    Brightness brightness() => Theme.of(tester.element(find.byType(TabRootHeader))).brightness;
    expect(brightness(), Brightness.dark);

    await tester.tap(find.text(AccountCopy.themeLight));
    await tester.pumpAndSettle();
    expect(brightness(), Brightness.light);
    expect(find.byType(AccountSheet), findsOneWidget, reason: 'the sheet stays open while the theme changes');

    await tester.tap(find.text(AccountCopy.themeDark));
    await tester.pumpAndSettle();
    expect(brightness(), Brightness.dark);
  });

  final rows = <String, String>{
    AccountCopy.rowAccount: AccountSheetPaths.account,
    AccountCopy.rowNotifications: AccountSheetPaths.notifications,
    AccountCopy.rowStudyDays: AccountSheetPaths.studyDays,
    AccountCopy.rowPrivacy: AccountSheetPaths.privacy,
    AccountCopy.rowHelp: AccountSheetPaths.help,
    AccountCopy.practiceTitle: AccountSheetPaths.account,
    AccountCopy.aiTitle: AccountSheetPaths.ask,
  };
  for (final MapEntry(key: label, value: path) in rows.entries) {
    testWidgets('"$label" closes the sheet and opens $path', (tester) async {
      await _pumpApp(tester);
      await _openSheet(tester);
      await tester.ensureVisible(find.text(label));
      await tester.pumpAndSettle();
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
      expect(find.byType(AccountSheet), findsNothing);
      expect(find.text('page $path'), findsOneWidget);
    });
  }

  testWidgets('"Write to us" opens the mail app, and Help when there is none', (tester) async {
    final mailer = _Mailer(composes: false);
    await _pumpApp(tester, mailer: mailer);
    await _openSheet(tester);
    await tester.ensureVisible(find.text(AccountCopy.rowContact));
    await tester.pumpAndSettle();
    await tester.tap(find.text(AccountCopy.rowContact));
    await tester.pumpAndSettle();
    expect(mailer.composed, 1);
    expect(find.text('page ${AccountSheetPaths.help}'), findsOneWidget);
  });

  testWidgets('Sign out asks first with the existing confirm', (tester) async {
    await _pumpApp(tester, extra: [
      sessionDraftRepositoryProvider.overrideWithValue(draftsWithUnsent(0)),
      outboxRepositoryProvider.overrideWithValue(outboxWith(0)),
    ]);
    await _openSheet(tester);
    await tester.ensureVisible(find.text(AccountCopy.signOut));
    await tester.pumpAndSettle();
    await tester.tap(find.text(AccountCopy.signOut));
    await tester.pumpAndSettle();
    // The confirm sheet's safe key.
    expect(find.text('Stay signed in'), findsOneWidget);
    await tester.tap(find.text('Stay signed in'));
    await tester.pumpAndSettle();
    expect(find.byType(AccountSheet), findsOneWidget);
  });
}
