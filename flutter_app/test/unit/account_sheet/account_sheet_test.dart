import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/features/credits/data/credits_models.dart' show CreditsOverview;
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
import 'package:mockmob/features/credits/credits.dart' show CreditsCopy;
import 'package:mockmob/features/credits/data/credits_data.dart' show meCreditsProvider;
import 'package:mockmob/features/notifications/copy.dart';
import 'package:mockmob/features/notifications/services/system_settings.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/features/you/copy.dart' show YouCopy;
import 'package:mockmob/features/you/you_providers.dart';

import '../notifications/support.dart' show Rig, prefsWith;
import '../notifications/widget_support.dart' show FakePermissionRequester, FakePrefsRepo, featureOverrides;
import '../you/you_test_support.dart' show FakeMeCredits, creditsState, draftsWithUnsent, outboxWith;

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
Future<void> _pumpApp(
  WidgetTester tester, {
  _Mailer? mailer,
  AuthSnapshot auth = _asha,
  List<Override> extra = const [],
  RemoteState<CreditsOverview>? credits,
}) async {
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
      stub(AccountSheetPaths.appearance),
      stub(AccountSheetPaths.privacy),
      stub(AccountSheetPaths.help),
      stub(AccountSheetPaths.ask),
      stub(AccountSheetPaths.credits),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: _lastWins([
        authSnapshotProvider.overrideWithBuild((ref, n) => auth),
        creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
        meCreditsProvider.overrideWith(() => FakeMeCredits(credits ?? creditsState(practice: 24, ai: 18))),
        appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
        supportMailerProvider.overrideWithValue(mailer ?? _Mailer()),
        ...extra,
      ]),
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

/// A container refuses two overrides of one provider; the test's own come last and win.
List<Override> _lastWins(List<Override> all) {
  final byOrigin = <Object?, Override>{};
  for (final o in all) {
    byOrigin[o.origin] = o;
  }
  return byOrigin.values.toList();
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
    expect(find.text(CreditsCopy.practiceMeaning), findsOneWidget);
    expect(find.text('18'), findsOneWidget);
    expect(find.text(CreditsCopy.aiMeaning), findsOneWidget);
    expect(find.text(CreditsCopy.renews(DateTime(2026, 11, 1))), findsOneWidget);
  });

  testWidgets('the avatar answers a finger anywhere in 48 dp', (tester) async {
    await _pumpApp(tester);
    final centre = tester.getCenter(find.byType(AccountAvatar));
    await tester.tapAt(centre + const Offset(23, 0));
    await tester.pumpAndSettle();
    expect(find.byType(AccountSheet), findsOneWidget);
  });

  testWidgets('a balance that did not load is never shown as zero', (tester) async {
    await _pumpApp(
      tester,
      auth: const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Asha'),
      credits: creditsState(practice: null, ai: 18),
    );
    await _openSheet(tester);
    expect(find.text('0'), findsNothing);
    expect(find.text(CreditsCopy.notLoaded), findsOneWidget);
  });

  testWidgets('the appearance switch changes the theme at once', (tester) async {
    await _pumpApp(tester);
    await _openSheet(tester);
    Brightness brightness() => Theme.of(tester.element(find.byType(TabRootHeader))).brightness;
    expect(brightness(), Brightness.dark);

    await tester.tap(find.text('Day'));
    await tester.pumpAndSettle();
    expect(brightness(), Brightness.light);
    expect(find.byType(AccountSheet), findsOneWidget, reason: 'the sheet stays open while the theme changes');

    await tester.tap(find.text('Night'));
    await tester.pumpAndSettle();
    expect(brightness(), Brightness.dark);
  });

  final rows = <String, String>{
    AccountCopy.rowAccount: AccountSheetPaths.account,
    AccountCopy.rowNotifications: AccountSheetPaths.notifications,
    YouCopy.rowFeel: AccountSheetPaths.appearance,
    AccountCopy.rowPrivacy: AccountSheetPaths.privacy,
    AccountCopy.rowHelp: AccountSheetPaths.help,
    'Practice credits': AccountSheetPaths.credits,
    'AI credits': AccountSheetPaths.credits,
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
    await tester.ensureVisible(find.text('Sign out'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    // The confirm sheet's safe key.
    expect(find.text('Stay signed in'), findsOneWidget);
    await tester.tap(find.text('Stay signed in'));
    await tester.pumpAndSettle();
    expect(find.byType(AccountSheet), findsOneWidget);
  });
  testWidgets('the theme switch is on screen at once; Sign out is the quiet last row, after Notifications', (tester) async {
    await _pumpApp(tester);
    await _openSheet(tester);
    final screen = tester.view.physicalSize / tester.view.devicePixelRatio;
    final rect = tester.getRect(find.text('Match phone'));
    expect(rect.top, greaterThanOrEqualTo(0));
    expect(rect.bottom, lessThanOrEqualTo(screen.height), reason: 'visible without a scroll');
    // Sign out is never pinned over the rows (final walk, H9): it sits under the last one.
    expect(tester.getTopLeft(find.text('Sign out')).dy, greaterThan(tester.getTopLeft(find.text(AccountCopy.rowNotifications)).dy));
    expect(tester.getTopLeft(find.text('Sign out')).dy, greaterThan(tester.getTopLeft(find.text(AccountCopy.rowContact)).dy));
  });

  testWidgets('Study days is not in the sheet: it lives on You', (tester) async {
    await _pumpApp(tester);
    await _openSheet(tester);
    expect(find.text('Study days'), findsNothing);
    // The rows, in order, are the ones the owner asked for.
    final order = [
      YouCopy.rowFeel,
      AccountCopy.rowAccount,
      AccountCopy.rowNotifications,
      AccountCopy.rowPrivacy,
      AccountCopy.rowHelp,
      AccountCopy.rowContact,
    ];
    double? last;
    for (final label in order) {
      await tester.ensureVisible(find.text(label));
      await tester.pumpAndSettle();
      final y = tester.getTopLeft(find.text(label)).dy;
      if (last != null) expect(y, greaterThan(last), reason: label);
      last = y;
    }
  });

  testWidgets('a Pro account shows the tag with the date it runs to', (tester) async {
    await _pumpApp(
      tester,
      auth: AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Asha', email: 'a@b.in', isPro: true, premiumUntil: DateTime(2027, 1, 12)),
      credits: creditsState(practice: 24, ai: 18, pro: true, proUntil: '2027-01-12'),
    );
    await _openSheet(tester);
    expect(find.text(AccountCopy.planPro), findsOneWidget);
    expect(find.text('until 12 Jan'), findsOneWidget);
  });

  testWidgets('credits kept from the last online read say when they were saved', (tester) async {
    final fresh = creditsState(practice: 24, ai: 18);
    await _pumpApp(
      tester,
      credits: RemoteState(
        value: fresh.value,
        fetchedAt: DateTime(2026, 10, 12, 21, 15),
        error: const ApiError(kind: ApiErrorKind.network, code: 'network'),
      ),
    );
    await _openSheet(tester);
    expect(find.text('Saved 9:15 PM'), findsOneWidget);
    expect(find.text(CreditsCopy.tryAgain), findsNothing);
  });

  testWidgets('the Saved line holds its room: Appearance sits at the same place with it and without it (v13 walk, 8)', (tester) async {
    double appearanceTop() => tester.getTopLeft(find.byType(MmSegmented<ThemeMode>)).dy;
    await _pumpApp(tester);
    await _openSheet(tester);
    final fresh = appearanceTop();
    expect(find.textContaining('Saved '), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    final stale = creditsState(practice: 24, ai: 18);
    await _pumpApp(
      tester,
      credits: RemoteState(
        value: stale.value,
        fetchedAt: DateTime(2026, 10, 12, 21, 15),
        error: const ApiError(kind: ApiErrorKind.network, code: 'network'),
      ),
    );
    await _openSheet(tester);
    expect(find.text('Saved 9:15 PM'), findsOneWidget);
    expect(appearanceTop(), closeTo(fresh, 0.5));
  });

  testWidgets('credits that did not load say so and offer Try again', (tester) async {
    final fake = FakeMeCredits(const RemoteState<CreditsOverview>(error: ApiError(kind: ApiErrorKind.network, code: 'network')));
    await _pumpApp(tester, extra: [meCreditsProvider.overrideWith(() => fake)]);
    await _openSheet(tester);
    expect(find.text(CreditsCopy.notLoaded), findsWidgets);
    final onOpen = fake.refreshes;
    await tester.tap(find.text(CreditsCopy.tryAgain));
    await tester.pumpAndSettle();
    expect(fake.refreshes, onOpen + 1);
  });

  testWidgets('opening the sheet reads the balances again', (tester) async {
    final fake = FakeMeCredits(creditsState(practice: 24, ai: 18));
    await _pumpApp(tester, extra: [meCreditsProvider.overrideWith(() => fake)]);
    expect(fake.refreshes, 0);
    await _openSheet(tester);
    expect(fake.refreshes, 1);
  });

  testWidgets('fresh credits show no status line', (tester) async {
    await _pumpApp(tester);
    await _openSheet(tester);
    expect(find.textContaining('Saved '), findsNothing);
    expect(find.text(CreditsCopy.tryAgain), findsNothing);
  });

  group('the Notifications row', () {
    late Rig rig;
    late FakePermissionRequester permission;
    late _Settings settings;

    Future<void> pumpRow(WidgetTester tester, NotificationPermission perm, {NotificationPermission after = NotificationPermission.granted}) async {
      rig = Rig();
      permission = FakePermissionRequester(perm, afterRequest: after);
      settings = _Settings();
      await _pumpApp(tester, extra: [
        ...featureOverrides(rig: rig, repo: FakePrefsRepo(prefsWith()), permission: permission),
        systemSettingsProvider.overrideWithValue(settings),
      ]);
      await _openSheet(tester);
      await tester.ensureVisible(find.text(AccountCopy.rowNotifications));
      await tester.pumpAndSettle();
    }

    testWidgets('off: it says Off and carries a Turn on key; the row still opens its page', (tester) async {
      await pumpRow(tester, NotificationPermission.notAsked);
      expect(find.text(NotificationsCopy.rowOff), findsOneWidget);
      expect(find.text(NotificationsCopy.inviteTurnOn), findsOneWidget);
      final pill = tester.getRect(find.bySemanticsLabel(NotificationsCopy.inviteTurnOnLabel));
      final row = tester.getRect(find.bySemanticsLabel('${AccountCopy.rowNotifications}. ${NotificationsCopy.rowOff}'));
      expect(pill.height, greaterThanOrEqualTo(48));
      expect(row.height, greaterThanOrEqualTo(48));
      expect(pill.overlaps(row), isFalse, reason: 'the two targets never overlap');

      await tester.tap(find.text(AccountCopy.rowNotifications));
      await tester.pumpAndSettle();
      expect(find.text('page ${AccountSheetPaths.notifications}'), findsOneWidget);
      expect(permission.requests, 0);
    });

    testWidgets('Turn on asks Android and the row then reads On', (tester) async {
      await pumpRow(tester, NotificationPermission.notAsked);
      await tester.tap(find.text(NotificationsCopy.inviteTurnOn));
      await tester.pumpAndSettle();
      expect(permission.requests, 1);
      expect(find.text(NotificationsCopy.inviteTurnOn), findsNothing);
      expect(find.text(NotificationsCopy.rowOff), findsNothing);
      expect(find.byType(AccountSheet), findsOneWidget, reason: 'Turn on does not close the sheet');
    });

    testWidgets('a refusal leaves the row off and says so once', (tester) async {
      await pumpRow(tester, NotificationPermission.notAsked, after: NotificationPermission.notAsked);
      await tester.tap(find.text(NotificationsCopy.inviteTurnOn));
      await tester.pumpAndSettle();
      expect(find.text(NotificationsCopy.inviteTurnOn), findsOneWidget);
      expect(find.text(NotificationsCopy.inviteRefused), findsOneWidget);
    });

    testWidgets('blocked: it says so and the key opens Android settings', (tester) async {
      await pumpRow(tester, NotificationPermission.denied);
      expect(find.text(NotificationsCopy.rowBlocked), findsOneWidget);
      await tester.tap(find.text(NotificationsCopy.inviteOpenSettings));
      await tester.pumpAndSettle();
      expect(settings.opened, 1);
    });

    testWidgets('on: no key, no Off, the ordinary row', (tester) async {
      await pumpRow(tester, NotificationPermission.granted);
      expect(find.text(NotificationsCopy.rowOff), findsNothing);
      expect(find.text(NotificationsCopy.inviteTurnOn), findsNothing);
      expect(find.text(NotificationsCopy.rowOn), findsOneWidget);
    });
  });
}

class _Settings extends SystemSettings {
  int opened = 0;

  @override
  Future<bool> openNotificationSettings() async {
    opened++;
    return true;
  }
}
