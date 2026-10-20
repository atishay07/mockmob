// Shared by the sheets and chains tests: a host with one "open" button, overrides that edit the den's JSON
// (live on, paper not sat), a fixture server that fails a call with a server code, and a spy that records
// stickers.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_navigator.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_api.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/mob_v3_flags.dart';

import '../../../helpers/golden_harness.dart';
import '../../you/you_test_support.dart' show youOverrides;
import '../mob_test_kit.dart';
import 'mob_v3_test_kit.dart';

typedef JsonEdit = void Function(Map<String, dynamic> den);

/// Overrides of a v3 screen with the den's JSON edited (the server itself is unchanged).
List<Override> sheetOverrides(MobV3FakeServer server, {JsonEdit? edit, RecordingNavigator? nav, bool nudges = false}) {
  final json = Map<String, dynamic>.from(server.denNow());
  if (edit != null) edit(json);
  return [
    ...mobOverrides(RemoteState(value: MobRead.fromJson(json), fetchedAt: v3Now), now: v3Now, nav: nav),
    mobV3EnabledProvider.overrideWithValue(true),
    mobV3FixturesProvider.overrideWithValue(true),
    mobV3FakeServerProvider.overrideWithValue(server),
    proNudgesOnProvider.overrideWithValue(nudges),
  ];
}

/// The Mob's sheet overrides with the student's own credit balance (null: not read yet).
List<Override> sheetOverridesWithBalance(MobV3FakeServer server, {int? balance, bool nudges = false}) => [
      ...youOverrides(auth: AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', creditBalance: balance), now: v3Now),
      mobRepositoryProvider.overrideWithBuild((ref, n) => RemoteState(value: MobRead.fromJson(server.denNow()), fetchedAt: v3Now)),
      mobPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      mobNavigatorProvider.overrideWithValue(RecordingNavigator()),
      mobActionsProvider.overrideWith((ref) => FakeMobActions(ref)),
      mobV3EnabledProvider.overrideWithValue(true),
      mobV3FixturesProvider.overrideWithValue(true),
      mobV3FakeServerProvider.overrideWithValue(server),
      proNudgesOnProvider.overrideWithValue(nudges),
    ];

Map<String, dynamic> v3Of(Map<String, dynamic> den) => den['v3'] as Map<String, dynamic>;

/// Makes live rooms available in the den's JSON.
void liveOn(Map<String, dynamic> den, {bool hoursOk = true, bool allowed = true}) {
  v3Of(den)['live'] = {'enabled': true, 'hoursOk': hoursOk};
  if (allowed) (v3Of(den)['starts'] as Map<String, dynamic>)['modes'] = ['async', 'live'];
}

/// A key by its label (a key draws its label twice, so a plain text finder finds two).
Finder keyLabel(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.label == label, description: 'key "$label"');

/// Scrolls [f] into view in a sheet and taps it. The test font is wide, so a sheet's body can run past its frame.
Future<void> tapAt(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.tap(f);
  await t.pumpAndSettle();
}

/// Taps a key that opens the run: the run screen counts down and its Folds breathe, so it never
/// settles; pump a second of frames instead.
Future<void> tapToRun(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.tap(f);
  for (var i = 0; i < 60; i++) {
    await t.pump(const Duration(milliseconds: 16));
  }
}

class Host extends StatelessWidget {
  const Host({super.key, required this.open});

  final void Function(BuildContext) open;

  @override
  Widget build(BuildContext context) => Center(child: TextButton(onPressed: () => open(context), child: const Text('open')));
}

Future<void> openSheet(WidgetTester tester, void Function(BuildContext) open, List<Override> overrides, {double scale = 1, Brightness b = Brightness.dark, Size size = const Size(360, 800)}) async {
  await pumpMockmob(tester, Host(open: open), brightness: b, size: size, textScale: scale, disableAnimations: true, overrides: overrides);
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

ApiError serverError(String code, {int status = 409}) => ApiError(
      kind: switch (status) { 402 => ApiErrorKind.paymentRequired, 422 => ApiErrorKind.validation, 503 => ApiErrorKind.unavailable, _ => ApiErrorKind.conflict },
      code: code,
      status: status,
    );

/// The fixture server, except that named calls fail with a server code.
class FailingServer extends MobV3FakeServer {
  FailingServer({super.scenario, super.billing, super.clock, this.openGameCode, this.micCode, this.pauseCode, this.openGameOnLiveOnly = false}) {
    answerDelay = Duration.zero;
  }

  final String? openGameCode;
  final String? micCode;
  final String? pauseCode;
  final bool openGameOnLiveOnly;
  final List<GameMode> openedModes = [];
  final List<GameFormat> openedFormats = [];
  final List<int?> openedMinutes = [];

  @override
  Future<MobGame> openGame({required String mob, required GameFormat format, required GameMode mode, required int count, String? chapter, String? rematchOf, int? minutes}) {
    openedModes.add(mode);
    openedFormats.add(format);
    openedMinutes.add(minutes);
    if (openGameCode != null && (!openGameOnLiveOnly || mode == GameMode.live)) throw serverError(openGameCode!, status: openGameCode == 'LIVE_BUSY' ? 503 : (openGameCode == 'LENGTH_INVALID' ? 422 : 409));
    return super.openGame(mob: mob, format: format, mode: mode, count: count, chapter: chapter, rematchOf: rematchOf, minutes: minutes);
  }

  @override
  Future<int?> mic({required String mob, required String to}) {
    if (micCode != null) throw serverError(micCode!);
    return super.mic(mob: mob, to: to);
  }

  @override
  Future<ChainState> pause(List<String> days) {
    if (pauseCode != null) throw serverError(pauseCode!, status: pauseCode == 'PAUSE_PAST' ? 422 : 409);
    return super.pause(days);
  }
}

/// The fixture server, recording the stickers it was sent.
class StickerSpy extends MobV3FakeServer {
  StickerSpy({super.scenario, super.billing, super.clock}) {
    answerDelay = Duration.zero;
  }

  final List<StickerKind> sent = [];

  @override
  Future<void> sticker({required String mob, String? game, required StickerKind kind}) {
    sent.add(kind);
    return super.sticker(mob: mob, game: game, kind: kind);
  }
}

/// Every string drawn on screen, in one list.
List<String> allTexts(WidgetTester tester) => [
      for (final w in tester.widgetList<Text>(find.byType(Text))) ?w.data ?? w.textSpan?.toPlainText(),
    ];

/// True when no drawn text matches [pattern].
bool noText(WidgetTester tester, Pattern pattern) => !allTexts(tester).any((t) => t.contains(pattern));
