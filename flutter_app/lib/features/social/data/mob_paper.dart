import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/domain/session_rules.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/local_scope.dart';
import '../../../core/repositories/session_draft_repository.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/sync/sync_providers.dart';
import 'mob_models.dart';
import 'mob_repository.dart';

sealed class MobPaperOutcome {
  const MobPaperOutcome();
}

/// The paper's draft is on this phone: open `/run/<sessionId>`.
class MobPaperStarted extends MobPaperOutcome {
  const MobPaperStarted(this.sessionId, {this.resumed = false});

  final String sessionId;

  /// The paper was already running on this phone and simply opens where it was.
  final bool resumed;
}

class MobPaperFailed extends MobPaperOutcome {
  const MobPaperFailed(this.failure);

  final MobFailure failure;
}

/// The key of a Mob paper's draft on the phone: one row per Mob and week (or extra paper), so it
/// never takes the row of an ordinary quick set of the same subject and length.
String mobPaperDraftKey({required String userId, required String mobId, required String paperKey}) => 'mm:mob:$userId:$mobId:$paperKey';

/// Starts or resumes a Mob paper (`POST /api/mob/paper/start`): the same questions in the same option
/// order for every member, no credits and no daily allowance. The server derives its own generation
/// key per member and week, so a retry resumes the same session and is never charged twice. The reply
/// is a practice start: the session engine writes the draft and journal before the runner opens, and
/// the paper then finishes as any practice (the server records the sitting).
class MobPaperLauncher {
  MobPaperLauncher({required this.api, required this.drafts, required this.userId, required this.startEngine, required this.now});

  final ApiClient api;
  final SessionDraftRepository drafts;
  final String Function() userId;
  final Future<SessionEngine> Function(StartSessionArgs) startEngine;
  final int Function() now;

  final Map<String, Future<MobPaperOutcome>> _inFlight = {};

  Future<MobPaperOutcome> start(Mob mob, {MobExtra? extra}) {
    final key = mobPaperDraftKey(userId: userId(), mobId: mob.id, paperKey: extra?.id ?? mob.week.key);
    // A second tap while a start is running joins the first.
    return _inFlight[key] ??= _start(mob, extra, key).whenComplete(() {
      _inFlight.remove(key);
    });
  }

  Future<MobPaperOutcome> _start(Mob mob, MobExtra? extra, String key) async {
    try {
      // The paper is already on this phone and still open: carry on where it was.
      final saved = await drafts.byKey(key);
      if (saved != null && resumableDraft(saved, generationKey: saved.generationKey, nowMs: now())) {
        return MobPaperStarted(saved.sessionId, resumed: true);
      }
      final SessionView view;
      try {
        final response = await api.post(
          '/api/mob/paper/start',
          body: {'mob': mob.id, 'extra': ?extra?.id},
          options: const ApiOptions(retries: 0, receiveTimeout: Duration(seconds: 60)),
        );
        view = SessionView.fromJson(response.map);
      } on ApiError catch (e) {
        return MobPaperFailed(mobFailureFor(e));
      }
      final id = view.meta.sessionId.isNotEmpty ? view.meta.sessionId : view.id;
      // A paper with no deadline after the server's own clock would anchor the timer at zero and
      // submit itself empty on its first tick: refused before anything is written.
      final expires = view.expiresAt.millisecondsSinceEpoch;
      if (view.questions.isEmpty || id.isEmpty || expires <= 0 || expires <= view.serverNowMs) {
        return const MobPaperFailed(MobFailure.generic);
      }
      try {
        final engine = await startEngine(
          StartSessionArgs(
            view: view,
            subject: mob.subject,
            mode: 'quick',
            count: view.questions.length,
            generationKey: await drafts.generationKeyFor(key),
            draftKey: key,
          ),
        );
        // The draft and journal are on the phone now; the runner restores its own engine from them.
        engine.dispose();
      } on Object {
        // The session exists on the server and resumes on the next try.
        return const MobPaperFailed(MobFailure.generic);
      }
      await drafts.clearGenerationKey(key);
      return MobPaperStarted(id);
    } on Object {
      return const MobPaperFailed(MobFailure.generic);
    }
  }
}

final mobPaperLauncherProvider = Provider<MobPaperLauncher>((ref) {
  return MobPaperLauncher(
    api: ref.watch(apiClientProvider),
    drafts: ref.watch(sessionDraftRepositoryProvider),
    userId: () => ref.read(userIdProvider) ?? (throw const SignedOutException()),
    startEngine: ref.watch(sessionEngineStarterProvider),
    now: () => ref.read(nowProvider)().millisecondsSinceEpoch,
  );
});
