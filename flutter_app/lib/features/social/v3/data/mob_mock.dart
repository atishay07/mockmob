// Full mock together (D167): a Mob v3 game whose paper is the subject's full mock. Sitting it opens the app's
// own mock runner (`/run/<session>`), and submitting it plays the app's mark-sheet reveal, exactly as any full
// mock does. The Mob comparison of everyone's mark sheets is the game's podium (screens/podium_screen.dart).
//
// The server starts the paper on `POST /api/mob/paper/start {mob, game}` (data/mob_paper.dart): the same 50
// questions in the same order for every member, 60 minutes, a Free member pays 50 credits when the paper starts (once per game; Pro pays nothing), never the first free mock, answers held
// until the game closes. In fixture mode the app's practice starter makes the paper (the demo build's 50
// questions) and the fixture server records the sitting so the comparison has a row for you.

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/routes.dart' show AppRoutes;
import '../../../practice/data/practice_starter.dart';
import '../../../practice/model/practice_selection.dart';
import '../../data/mob_paper.dart';
import '../../data/mob_repository.dart';
import '../copy_v3.dart';
import '../mob_v3_flags.dart';
import 'mob_v3_api.dart';

/// Why a full mock could not start: the sentence to say, and the server's code when it sent one (MOCK_CREDITS
/// opens the sit sheet in its short state).
class SitFailure {
  const SitFailure(this.message, [this.code]);

  final String message;
  final String? code;

  /// The server refused for want of credits; nothing was charged.
  bool get short => code == 'MOCK_CREDITS';
}

SitFailure _failure(Object e) => SitFailure(MobV3Copy.error(e), MobV3Copy.codeOf(e)?.toUpperCase());

/// Opens the full mock of [gameId] in the app's runner. Returns null once the runner is opening, or why it
/// could not start.
Future<SitFailure?> sitMobMock(BuildContext context, String gameId) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final router = GoRouter.maybeOf(context);
  final mob = container.read(mobRepositoryProvider).value?.mob;
  if (mob == null || router == null) return const SitFailure(MobV3Copy.generic);
  String? sessionId;
  if (container.read(mobV3FixturesProvider)) {
    try {
      container.read(mobV3FakeServerProvider).sitMock(gameId);
    } on Object catch (e) {
      return _failure(e);
    }
    final out = await container.read(practiceStarterProvider).start(PracticeSelection(mode: PracticeMode.full, subjectId: mob.subject));
    if (out is Started) sessionId = out.sessionId;
    if (out is StartFailed) return SitFailure(out.message ?? MobV3Copy.generic);
  } else {
    final out = await container.read(mobPaperLauncherProvider).start(mob, gameId: gameId);
    switch (out) {
      case MobPaperStarted(sessionId: final id):
        sessionId = id;
      case MobPaperFailed(:final cause):
        // The paper's state may have changed (closed, already sat): the den reads itself again.
        _refresh(container);
        return cause == null ? const SitFailure(MobV3Copy.generic) : _failure(cause);
    }
  }
  if (sessionId == null) return const SitFailure(MobV3Copy.generic);
  _refresh(container);
  unawaited(router.push<void>(AppRoutes.run(sessionId)));
  return null;
}

void _refresh(ProviderContainer container) {
  unawaited(container.read(mobRepositoryProvider.notifier).refresh(force: true).catchError((Object _) {}));
}
