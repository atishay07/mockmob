// The Account sheet over a tab root at 390 dp, Night and Daylight: the avatar on the header, the
// identity, both credit balances, the appearance switch, the settings rows and sign out. The fold
// shot (390 by 844) shows the theme switch without scrolling; the full shots (390 by 1000) show
// the Notifications row off, on and blocked, and the credits kept from the last online read.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/settings/appearance_settings.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/account/account_avatar.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/credits/data/credits_data.dart' show meCreditsProvider;
import 'package:mockmob/features/credits/data/credits_models.dart' show CreditsOverview;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/notifications/support.dart' show Rig, prefsWith;
import '../../unit/notifications/widget_support.dart' show FakePermissionRequester, FakePrefsRepo, featureOverrides;
import '../../unit/you/you_test_support.dart' show FakeMeCredits, creditsState;

const Size _fold = Size(390, 844);
const Size _full = Size(390, 1000);

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';

    testWidgets('tab root header with the account key, $tag', (tester) async {
      await pumpMockmob(
        tester,
        const SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Column(
              children: [
                TabRootHeader(title: 'Practice'),
                SizedBox(height: 16),
                TabRootHeader(title: 'You', account: true),
              ],
            ),
          ),
        ),
        brightness: brightness,
        size: const Size(360, 160),
        disableAnimations: true,
        overrides: _overrides(brightness: brightness),
      );
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/account_header_$tag.png'));
    });

    Future<void> openSheet(
      WidgetTester tester, {
      Size size = _full,
      NotificationPermission permission = NotificationPermission.notAsked,
      RemoteState<CreditsOverview>? credits,
      AuthSnapshot? auth,
    }) async {
      await pumpMockmob(
        tester,
        const SafeArea(
          child: Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 0), child: TabRootHeader(title: 'Practice')),
        ),
        brightness: brightness,
        size: size,
        disableAnimations: true,
        overrides: _overrides(brightness: brightness, permission: permission, credits: credits, auth: auth),
      );
      await tester.tap(find.byType(AccountAvatarButton));
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 60));
      }
      await settleImages(tester);
    }

    testWidgets('account sheet at the fold, $tag', (tester) async {
      await openSheet(tester, size: _fold);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/account_sheet_$tag.png'));
    });

    testWidgets('account sheet, reminders off, $tag', (tester) async {
      await openSheet(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/account_sheet_off_$tag.png'));
    });

    testWidgets('account sheet, reminders on, $tag', (tester) async {
      await openSheet(tester, permission: NotificationPermission.granted);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/account_sheet_on_$tag.png'));
    });

    testWidgets('account sheet, blocked in Android, $tag', (tester) async {
      await openSheet(tester, permission: NotificationPermission.denied);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/account_sheet_blocked_$tag.png'));
    });

    testWidgets('account sheet, Pro with the credits kept offline, $tag', (tester) async {
      final fresh = creditsState(practice: 24, ai: 18, pro: true, proUntil: '2027-01-12');
      await openSheet(
        tester,
        permission: NotificationPermission.granted,
        credits: RemoteState(value: fresh.value, fetchedAt: fresh.fetchedAt, error: const ApiError(kind: ApiErrorKind.network, code: 'network')),
        auth: AuthSnapshot(
          status: AuthStatus.signedIn,
          userId: 'u1',
          name: 'Asha Verma',
          email: 'asha.verma@gmail.com',
          isPro: true,
          premiumUntil: DateTime(2027, 1, 12),
        ),
      );
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/account_sheet_pro_offline_$tag.png'));
    });
  }
}

/// The saved Appearance choice, matching the frame, so the switch shows the theme that is on screen.
class _Mode extends ThemeModeSetting {
  _Mode(this.mode);

  final ThemeMode mode;

  @override
  ThemeMode build() => mode;
}

List<Override> _overrides({
  required Brightness brightness,
  NotificationPermission permission = NotificationPermission.notAsked,
  RemoteState<CreditsOverview>? credits,
  AuthSnapshot? auth,
}) => [
  // The reminders row reads the permission, the setting and the next planned reminder.
  ...featureOverrides(
    rig: Rig(),
    repo: FakePrefsRepo(prefsWith()),
    permission: FakePermissionRequester(permission),
    appPrefs: AppPrefs(MemoryPrefsStore()),
  ),
  themeModeProvider.overrideWith(() => _Mode(brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light)),
  authSnapshotProvider.overrideWithBuild(
    (ref, n) =>
        auth ??
        const AuthSnapshot(
          status: AuthStatus.signedIn,
          userId: 'u1',
          name: 'Asha Verma',
          email: 'asha.verma@gmail.com',
          creditBalance: 24,
        ),
  ),
  creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
  meCreditsProvider.overrideWith(() => FakeMeCredits(credits ?? creditsState(practice: 24, ai: 18))),
];
