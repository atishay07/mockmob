// Shared harness for the SOCIAL slice tests (D0, D0a, J1, shelf, settings, invite card): Aarav signed in
// with three subjects, the fixture server on the fixed clock, and a server that fails on demand with the
// server's own codes (FOLD_LOCKED, NAME_KEY_INVALID, STEP_OUT_DONE, INVITE_...), recording what it was asked.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/social/data/mob_models.dart' show MobRead;
import 'package:mockmob/features/social/data/mob_navigator.dart';
import 'package:mockmob/features/social/data/mob_repository.dart' show MobWrite, mobActionsProvider, mobPrefsStoreProvider, mobRepositoryProvider;
import 'package:mockmob/features/social/v3/data/mob_v3_api.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/mob_v3_flags.dart';

import '../../you/you_test_support.dart' show youOverrides;
import '../mob_test_kit.dart' show FakeMobActions, RecordingNavigator;
import '../../../helpers/golden_harness.dart';
import 'mob_v3_test_kit.dart';

const AuthSnapshot aaravAuth = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'aarav.k@example.com',
  name: 'Aarav',
  subjects: ['accountancy', 'business_studies', 'economics'],
);

/// Aarav with no subjects chosen yet.
const AuthSnapshot noSubjectsAuth = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'aarav.k@example.com', name: 'Aarav');

/// The overrides every SOCIAL screen needs: the You overrides for [auth], the repository seeded with the
/// server's den, the v3 flags on and the server as the Mob API. [actions] swaps the old Mob's actions (the
/// show-score call, leave, remove), so a test can read what was asked.
List<Override> socialOverrides(MobV3FakeServer server, {AuthSnapshot auth = aaravAuth, FakeMobActions Function(Ref ref)? actions, RecordingNavigator? nav, List<Override> extra = const []}) => [
      ...youOverrides(auth: auth, now: v3Now),
      mobRepositoryProvider.overrideWithBuild((ref, n) => RemoteState(value: MobRead.fromJson(server.denNow()), fetchedAt: v3Now)),
      mobPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      mobNavigatorProvider.overrideWithValue(nav ?? RecordingNavigator()),
      mobActionsProvider.overrideWith(actions ?? (ref) => FakeMobActions(ref)),
      mobV3EnabledProvider.overrideWithValue(true),
      mobV3FixturesProvider.overrideWithValue(true),
      mobV3FakeServerProvider.overrideWithValue(server),
      ...extra,
    ];

/// The fixture server, failing the named routes with the server's code, and recording every call.
class SocialServer extends MobV3FakeServer {
  SocialServer({super.scenario = 'heavy', super.billing = 'off', this.failures = const {}, this.previews = const {}}) : super(clock: () => v3Now) {
    answerDelay = Duration.zero;
  }

  /// route name -> the server's error code, for example `createMob: 'FOLD_LOCKED'`.
  final Map<String, String> failures;

  /// A code -> a fixed preview, ahead of the fixture's own rules.
  final Map<String, JoinPreview> previews;

  final List<String> calls = [];

  void _maybeFail(String route) {
    final code = failures[route];
    if (code == null) return;
    final status = code == 'NAME_KEY_INVALID' ? 422 : (code == 'INVITE_EXPIRED' || code == 'INVITE_INVALID' ? 410 : 409);
    throw ApiError(kind: status == 422 ? ApiErrorKind.validation : ApiErrorKind.conflict, code: code, status: status);
  }

  @override
  Future<Object?> createMob({required String subject, required String name, required int colour, required int nameKey, required FoldKey fold}) async {
    calls.add('createMob:$subject:$name:$colour:$nameKey:${fold.name}');
    _maybeFail('createMob');
    return super.createMob(subject: subject, name: name, colour: colour, nameKey: nameKey, fold: fold);
  }

  @override
  Future<JoinPreview> joinPreview(String code) async {
    calls.add('preview:$code');
    final p = previews[code];
    if (p != null) return p;
    _maybeFail('joinPreview');
    return super.joinPreview(code);
  }

  @override
  Future<Object?> join({required String code, required String name, required int colour, required FoldKey fold}) async {
    calls.add('join:$code:$name:$colour:${fold.name}');
    _maybeFail('join');
    return super.join(code: code, name: name, colour: colour, fold: fold);
  }

  @override
  Future<Object?> settings({required String mob, bool? showPodium, int? nameKey}) async {
    calls.add('settings:$showPodium:$nameKey');
    _maybeFail('settings');
    return super.settings(mob: mob, showPodium: showPodium, nameKey: nameKey);
  }

  @override
  Future<Object?> stepOut({required String mob, required bool on}) async {
    calls.add('stepOut:$on');
    _maybeFail('stepOut');
    return super.stepOut(mob: mob, on: on);
  }

  @override
  Future<void> profile(FoldKey fold, {FoldFinish finish = FoldFinish.plain}) async {
    calls.add('profile:${fold.name}:${finish.name}');
    _maybeFail('profile');
    return super.profile(fold, finish: finish);
  }

  @override
  Future<Shelf> shelf() async {
    calls.add('shelf');
    _maybeFail('shelf');
    return super.shelf();
  }
}

/// Pumps [screen] the way the SOCIAL tests need: a 360 by 780 phone, Night, motion reduced (so no loop
/// keeps the frame busy), the SOCIAL overrides.
Future<void> pumpSocial(
  WidgetTester tester,
  Widget screen,
  MobV3FakeServer server, {
  AuthSnapshot auth = aaravAuth,
  Brightness brightness = Brightness.dark,
  Size size = const Size(360, 780),
  double scale = 1,
  bool reduced = true,
  FakeMobActions Function(Ref ref)? actions,
  RecordingNavigator? nav,
  List<Override> extra = const [],
}) =>
    pumpMockmob(
      tester,
      screen,
      brightness: brightness,
      size: size,
      textScale: scale,
      wrapInScaffold: false,
      disableAnimations: reduced,
      overrides: socialOverrides(server, auth: auth, actions: actions, nav: nav, extra: extra),
    );

/// Lets a screen finish what it started (a sheet opening, a call to the fixture server).
Future<void> settleSocial(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 120));
  }
}

/// The old Mob's actions with `remove` recorded too (the shared fake leaves it to the network).
class SocialMobActions extends FakeMobActions {
  SocialMobActions(super.ref, {super.failure});

  @override
  MobWrite remove(String memberId) async {
    calls.add('remove:$memberId');
    return failure;
  }
}
