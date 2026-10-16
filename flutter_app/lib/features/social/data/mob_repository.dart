import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/storage/prefs_store.dart';
import 'mob_models.dart';

/// `GET /api/mob` (signed in). Cached like every other read, so the Mob card and page open with
/// the last state while the server answers. With the server's `MOB_ENABLED` off every route
/// answers 404 `MOB_DISABLED`, and the app then shows no Mob entry anywhere ([mobAvailableProvider]).
class MobRepository extends JsonRemoteNotifier<MobRead> {
  @override
  String get cacheKey => 'mob-v1';

  @override
  MobRead parse(Object? json) => MobRead.fromJson(asJson(json));

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/mob')).data;

  /// Shows a reply that carries the `GET` shape at once (create, join, patch, remove).
  void accept(Object? body) {
    try {
      final read = parse(body);
      state = RemoteState(value: read, fetchedAt: DateTime.now());
    } on Object {
      // A reply that does not parse is followed by a fresh read below.
    }
  }

  void clear() => state = RemoteState(value: const MobRead(null), fetchedAt: DateTime.now());
}

final mobRepositoryProvider = NotifierProvider<MobRepository, RemoteState<MobRead>>(MobRepository.new);

/// The server's switch is off (404 `MOB_DISABLED`, or any 404 on `/api/mob`).
bool mobDisabledError(ApiError? e) => e != null && (e.hasCode('MOB_DISABLED') || e.kind == ApiErrorKind.notFound);

/// False hides every Mob entry point: the feature is off on the server, or nothing has been read
/// yet and nothing is cached. A failed read with nothing cached also hides the entry points on
/// Today (they come back on the next read); the Mob page itself names the failure.
final mobAvailableProvider = Provider<bool>((ref) {
  final s = ref.watch(mobRepositoryProvider);
  if (mobDisabledError(s.error)) return false;
  return s.value != null;
});

/// The Mob, or null when not in one (or not read yet).
final currentMobProvider = Provider<Mob?>((ref) {
  final s = ref.watch(mobRepositoryProvider);
  if (mobDisabledError(s.error)) return null;
  return s.value?.mob;
});

/// The phone-only memories of the Mob: which sitters this student has already seen ink in, and
/// whether this week's completed ring has had its Mobi moment.
final mobPrefsStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

/// Why a Mob write did not happen, each with its own sentence in [MobCopy].
enum MobFailure { offline, alreadyInMob, nameInvalid, subjectInvalid, inviteInvalid, inviteExpired, full, notOwner, notSat, alreadyNudged, weekClosed, alreadySat, rateLimited, generic }

MobFailure mobFailureFor(ApiError e) {
  if (e.isOffline) return MobFailure.offline;
  if (e.hasCode('ALREADY_IN_MOB')) return MobFailure.alreadyInMob;
  if (e.hasCode('NAME_INVALID')) return MobFailure.nameInvalid;
  if (e.hasCode('SUBJECT_INVALID')) return MobFailure.subjectInvalid;
  if (e.hasCode('INVITE_INVALID')) return MobFailure.inviteInvalid;
  if (e.hasCode('INVITE_EXPIRED')) return MobFailure.inviteExpired;
  if (e.hasCode('MOB_FULL')) return MobFailure.full;
  if (e.hasCode('NOT_OWNER')) return MobFailure.notOwner;
  if (e.hasCode('NOT_SAT_YET')) return MobFailure.notSat;
  if (e.hasCode('ALREADY_NUDGED')) return MobFailure.alreadyNudged;
  if (e.hasCode('WEEK_CLOSED')) return MobFailure.weekClosed;
  if (e.hasCode('PAPER_ALREADY_SAT')) return MobFailure.alreadySat;
  if (e.isRateLimited) return MobFailure.rateLimited;
  if (e.status == 404 && e.hasCode('NOT_IN_MOB')) return MobFailure.generic;
  return MobFailure.generic;
}

/// The result of a Mob write: null on success, else why it failed.
typedef MobWrite = Future<MobFailure?>;

/// Every Mob write. Each one shows the server's reply when it carries the `GET` shape, then reads
/// the Mob again so the ring, members and invite never drift from the server.
class MobActions {
  MobActions(this.ref);

  final Ref ref;

  ApiClient get _api => ref.read(apiClientProvider);
  MobRepository get _repo => ref.read(mobRepositoryProvider.notifier);

  Future<MobFailure?> _run(Future<ApiResponse> Function() call, {bool acceptsShape = false, bool clears = false}) async {
    try {
      final response = await call();
      if (clears) {
        _repo.clear();
      } else if (acceptsShape) {
        _repo.accept(response.data);
      }
      await _repo.refresh(force: true);
      return null;
    } on ApiError catch (e) {
      return mobFailureFor(e);
    } on Object {
      return MobFailure.generic;
    }
  }

  MobWrite create({required String subject, required String name, required int colour}) =>
      _run(() => _api.post('/api/mob', body: {'subject': subject, 'name': name.trim(), 'colour': colour}, options: const ApiOptions(retries: 0)), acceptsShape: true);

  MobWrite join({required String code, required String name, required int colour}) =>
      _run(() => _api.post('/api/mob/join', body: {'code': code, 'name': name.trim(), 'colour': colour}, options: const ApiOptions(retries: 0)), acceptsShape: true);

  MobWrite updateMe({String? name, int? colour, bool? showScore, bool? nudgesMuted}) => _run(
        () => _api.patch('/api/mob/me', body: {'name': ?name?.trim(), 'colour': ?colour, 'showScore': ?showScore, 'nudgesMuted': ?nudgesMuted}),
        acceptsShape: true,
      );

  /// A new invite revokes the previous code (P2).
  MobWrite newInvite() => _run(() => _api.post('/api/mob/invite', options: const ApiOptions(retries: 0)));

  MobWrite leave({String? block}) => _run(() => _api.post('/api/mob/leave', body: {'block': ?block}, options: const ApiOptions(retries: 0)), clears: true);

  MobWrite remove(String memberId) =>
      _run(() => _api.post('/api/mob/remove', body: {'memberId': memberId}, options: const ApiOptions(retries: 0)), acceptsShape: true);

  MobWrite report({required String memberId, required String reason, bool alsoLeave = false, bool block = false}) => _run(
        () => _api.post('/api/mob/report', body: {'memberId': memberId, 'reason': reason, 'alsoLeave': alsoLeave, 'block': block}, options: const ApiOptions(retries: 0)),
        clears: alsoLeave,
      );

  /// "Sit it with me": once a week, to the members who have not sat, who are never named (P6).
  MobWrite nudge() => _run(() => _api.post('/api/mob/nudge', options: const ApiOptions(retries: 0)));

  /// The received note was shown once; it does not come back.
  Future<void> nudgeSeen() async {
    try {
      await _api.post('/api/mob/nudge/seen');
    } on Object {
      // The line simply shows again next time.
    }
  }

  /// The public invite read: subject and seats, never a name.
  Future<(MobInvitePreview?, MobFailure?)> preview(String code) async {
    try {
      final response = await _api.get('/api/mob/join/$code');
      return (MobInvitePreview.fromJson(asJson(response.data)), null);
    } on ApiError catch (e) {
      if (e.status == 410) return (null, MobFailure.inviteExpired);
      if (e.kind == ApiErrorKind.notFound) return (null, MobFailure.inviteInvalid);
      return (null, mobFailureFor(e));
    } on Object {
      return (null, MobFailure.generic);
    }
  }
}

final mobActionsProvider = Provider<MobActions>(MobActions.new);
