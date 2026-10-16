// The Account sheet over a tab root at 360 dp, Night and Daylight: the avatar on the header, the
// identity, both credit ledgers, the appearance switch, the settings rows and sign out.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/widgets/account/account_avatar.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/credits/data/credits_data.dart' show meCreditsProvider;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/you/you_test_support.dart' show FakeMeCredits, creditsState;

const Size _size = Size(360, 800);

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
        overrides: _overrides(),
      );
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/account_header_$tag.png'));
    });

    testWidgets('account sheet, $tag', (tester) async {
      await pumpMockmob(
        tester,
        const SafeArea(
          child: Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 0), child: TabRootHeader(title: 'Practice')),
        ),
        brightness: brightness,
        size: _size,
        disableAnimations: true,
        overrides: _overrides(),
      );
      await tester.tap(find.byType(AccountAvatarButton));
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 60));
      }
      await settleImages(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/account_sheet_$tag.png'));
    });
  }
}

List<Override> _overrides() => [
  authSnapshotProvider.overrideWithBuild(
    (ref, n) => const AuthSnapshot(
      status: AuthStatus.signedIn,
      userId: 'u1',
      name: 'Asha Verma',
      email: 'asha.verma@gmail.com',
      creditBalance: 24,
    ),
  ),
  creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
  meCreditsProvider.overrideWith(() => FakeMeCredits(creditsState(practice: 24, ai: 18))),
  appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
];
