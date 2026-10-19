import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/storage/prefs_store.dart';
import '../../pro_nudge/data/pro_nudge_controller.dart' show proNudgesOnProvider;
import '../copy.dart';
import 'mob_models.dart';
import '../v3/data/mob_v3_api.dart' show mobV3ApiProvider;
import '../v3/mob_v3_flags.dart' show mobV3FixturesProvider;

/// The phone-only memories of the Mob: which Mob is on screen, which sitters this student has
/// already seen ink in, and whether this week's completed ring has had its Mobi moment.
final mobPrefsStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

const String _selectedKey = 'mob.selected';

/// `GET /api/mob` (signed in), for the Mob on screen. A student can be in several Mobs (Free 1, Pro
/// 3) and every call names its Mob, so the one on screen is remembered on this phone (a per-viewer
/// convenience, never state that matters) and sent as `?mob=`. Cached like every other read, so the
/// Mob card and page open with the last state while the server answers. With the server's
/// `MOB_ENABLED` off every route answers 404 `MOB_DISABLED`, and the app then shows no Mob entry
/// anywhere ([mobAvailableProvider]).
class MobRepository extends JsonRemoteNotifier<MobRead> {
  String? _selected;
  bool _selectionLoaded = false;

  /// One cache row per Mob, so choosing another never shows the one before.
  @override
  String get cacheKey => '${ref.read(mobV3FixturesProvider) ? 'mob-v3fx' : 'mob-v2'}:${_selected ?? 'default'}';

  /// The Mob on screen (null: the server's default, the student's first).
  String? get selectedId => _selected;

  @override
  MobRead parse(Object? json) => MobRead.fromJson(asJson(json));

  Future<void> _loadSelection() async {
    if (_selectionLoaded) return;
    _selectionLoaded = true;
    try {
      final stored = await ref.read(mobPrefsStoreProvider).getString(_selectedKey);
      if (isMobId(stored)) _selected = stored;
    } on Object {
      // The default Mob shows.
    }
  }

  Future<void> _remember(String? id) async {
    _selected = id;
    try {
      final store = ref.read(mobPrefsStoreProvider);
      if (id == null) {
        await store.remove(_selectedKey);
      } else {
        await store.setString(_selectedKey, id);
      }
    } on Object {
      // Only a convenience.
    }
  }

  @override
  Future<CachedValue<MobRead>?> readCache(String userId) async {
    await _loadSelection();
    return super.readCache(userId);
  }

  @override
  Future<Object?> fetchJson() async {
    await _loadSelection();
    final id = _selected;
    // Mob v3 fixture mode (debug and walk builds with MOB_V3_FIXTURES=true): the fixture server answers.
    final body = ref.read(mobV3FixturesProvider)
        ? await ref.read(mobV3ApiProvider).den(mob: id)
        : (await ref.read(apiClientProvider).get('/api/mob', query: {'mob': ?id})).data;
    // Remember a choice only when there is one to make (several Mobs).
    final mob = parse(body).mob;
    if (mob != null) await _remember(mob.mobs.length > 1 ? mob.id : null);
    return body;
  }

  /// Shows a reply that carries the `GET` shape at once (create, join, patch, remove).
  void accept(Object? body) {
    try {
      final read = parse(body);
      final mob = read.mob;
      if (mob != null) _selected = mob.mobs.length > 1 ? mob.id : null;
      state = RemoteState(value: read, fetchedAt: DateTime.now());
    } on Object {
      // A reply that does not parse is followed by a fresh read below.
    }
  }

  /// Shows another of the student's Mobs: the old one clears at once, so no screen draws the wrong
  /// Mob under the new name.
  Future<void> select(String id) async {
    if (!isMobId(id) || id == _selected) return;
    await _remember(id);
    state = const RemoteState(loading: true);
    await refresh(force: true);
  }

  /// The student left a Mob. With another Mob left the page waits for it (the server's default); with
  /// none it shows the start form at once.
  void clear() {
    final others = (state.value?.mob?.mobs.length ?? 0) > 1;
    _selected = null;
    state = others ? const RemoteState(loading: true) : RemoteState(value: const MobRead(null), fetchedAt: DateTime.now());
  }
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

/// The Mob on screen, or null when not in one (or not read yet).
final currentMobProvider = Provider<Mob?>((ref) {
  final s = ref.watch(mobRepositoryProvider);
  if (mobDisabledError(s.error)) return null;
  return s.value?.mob;
});

/// Why a Mob call did not happen. Each has one plain sentence in `MobCopy`, the same sentence the
/// server sends for its code (a test holds the two together).
enum MobFailure {
  offline('OFFLINE'),
  unauthenticated('UNAUTHENTICATED'),
  disabled('MOB_DISABLED'),
  notInMob('NOT_IN_MOB'),
  notFound('NOT_FOUND'),
  inviteInvalid('INVITE_INVALID'),
  inviteExpired('INVITE_EXPIRED'),
  full('MOB_FULL'),
  alreadyInMob('ALREADY_IN_MOB'),
  mobLimit('MOB_LIMIT'),
  mobLimitPro('MOB_LIMIT_PRO'),
  mobCeiling('MOB_CEILING'),
  invitesPaused('INVITES_PAUSED'),
  joinPaused('JOIN_PAUSED'),
  weekInvalid('WEEK_INVALID'),
  extraNotFound('EXTRA_NOT_FOUND'),
  compareSitFirst('COMPARE_SIT_FIRST'),
  notSatThatWeek('NOT_SAT_THAT_WEEK'),
  comparePastAlone('COMPARE_PAST_ALONE'),
  bankThin('BANK_THIN'),
  noSubjects('NO_SUBJECTS'),
  mobRequired('MOB_REQUIRED'),
  proRequired('PRO_REQUIRED'),
  compareUnavailable('COMPARE_UNAVAILABLE'),
  shareFirst('SHARE_FIRST'),
  compareWaiting('COMPARE_WAITING'),
  freePaperUsed('FREE_PAPER_USED'),
  extraLimit('EXTRA_LIMIT'),
  extraClosed('EXTRA_CLOSED'),
  extraAlreadySat('EXTRA_ALREADY_SAT'),
  chapterInvalid('CHAPTER_INVALID'),
  lengthInvalid('LENGTH_INVALID'),
  notOwner('NOT_OWNER'),
  notSat('NOT_SAT_YET'),
  alreadyNudged('ALREADY_NUDGED'),
  alreadySat('PAPER_ALREADY_SAT'),
  weekClosed('WEEK_CLOSED'),
  paperExpired('PAPER_EXPIRED'),
  credits('CREDITS'),
  nameInvalid('NAME_INVALID'),
  nameRefused('NAME_REFUSED'),
  subjectInvalid('SUBJECT_INVALID'),
  colourInvalid('COLOUR_INVALID'),
  reasonInvalid('REASON_INVALID'),
  bodyInvalid('BODY_INVALID'),
  rateLimited('RATE_LIMITED'),
  paperUnavailable('PAPER_UNAVAILABLE'),
  migration('MIGRATION'),
  unavailable('UNAVAILABLE'),
  generic('GENERIC');

  const MobFailure(this.code);

  /// The server's code (or a local one: OFFLINE, GENERIC).
  final String code;

  /// A Free limit that Pro answers: with the Upgrade sheet on, the sentence names Pro and a tap opens
  /// the sheet (D80); with it off, the sentence is the plain fact and nothing names Pro.
  bool get needsPro => this == proRequired || this == mobLimit || this == freePaperUsed;

  /// The student must choose their subjects before a Mob can start: the way forward is Edit subjects.
  bool get needsSubjects => this == noSubjects || this == subjectInvalid;

  static MobFailure fromCode(String code) {
    final up = code.toUpperCase();
    for (final f in values) {
      if (f.code == up) return f;
    }
    return generic;
  }
}

MobFailure mobFailureFor(ApiError e) {
  if (e.isOffline) return MobFailure.offline;
  if (e.isRateLimited) return MobFailure.rateLimited;
  final f = MobFailure.fromCode(e.code);
  if (f != MobFailure.generic) return f;
  // An unknown code is read as the server asks: UNAVAILABLE.
  return e.kind == ApiErrorKind.server || e.kind == ApiErrorKind.unavailable ? MobFailure.unavailable : MobFailure.generic;
}

/// The result of a Mob write: null on success, else why it failed.
typedef MobWrite = Future<MobFailure?>;

/// What the server said beyond the code, for the two codes whose sentence names a real figure: the
/// 429's real wait and a thin chapter's count with the nearest paper that can be built.
class MobServerSaid {
  const MobServerSaid({this.message, this.suggest});

  factory MobServerSaid.from(ApiError e) {
    final detail = e.details['detail'];
    final suggest = detail is Map ? detail['suggest'] : null;
    return MobServerSaid(
      message: e.serverMessage,
      suggest: suggest is Map && suggest['count'] is int
          ? MobSuggestion(
              chapter: suggest['chapter'] as String?,
              count: suggest['count'] as int,
              ready: detail is Map ? detail['ready'] as int? : null,
              asked: detail is Map ? detail['asked'] as int? : null,
            )
          : null,
    );
  }

  final String? message;
  final MobSuggestion? suggest;
}

/// Every Mob call. Every call after the first names its Mob (`mob` in the body or the query), so
/// a write can never land in another Mob; creating and joining name none, because they make or
/// find one. Each write shows the server's reply when it carries the `GET` shape, then reads the
/// Mob again so the ring, members and invite never drift from the server.
class MobActions {
  MobActions(this.ref);

  final Ref ref;

  ApiClient get _api => ref.read(apiClientProvider);
  MobRepository get _repo => ref.read(mobRepositoryProvider.notifier);

  /// The Mob every scoped call names.
  String? get mobId {
    final fromState = ref.read(mobRepositoryProvider).value?.mob?.id;
    return isMobId(fromState) ? fromState : _repo.selectedId;
  }

  Map<String, Object?> _scoped([Map<String, Object?> body = const {}]) => {'mob': ?mobId, ...body};

  MobServerSaid? _said;
  MobFailure? _saidFor;

  /// The failure of [e], remembering the server's own sentence when it carries a figure (the real
  /// wait of a 429, a thin chapter's count) so [say] and [suggestion] can speak it.
  MobFailure _failed(ApiError e) {
    final f = mobFailureFor(e);
    if (f == MobFailure.rateLimited || f == MobFailure.bankThin) {
      _said = MobServerSaid.from(e);
      _saidFor = f;
    } else {
      _said = null;
      _saidFor = null;
    }
    return f;
  }

  /// The sentence for [failure]: the server's own when it said more than the code does (the real
  /// wait: "You can start another in 25 minutes"), else the app's copy for the code. A Free limit
  /// names Pro only while the Upgrade sheet can open (PLAY_BILLING on, a Free student).
  String say(MobFailure failure) {
    final said = _saidFor == failure ? _said?.message : null;
    return said ?? MobCopy.failure(failure, sell: ref.read(proNudgesOnProvider));
  }

  /// The nearest paper the bank can build, after a BANK_THIN (null otherwise).
  MobSuggestion? get suggestion => _saidFor == MobFailure.bankThin ? _said?.suggest : null;

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
      return _failed(e);
    } on Object {
      return MobFailure.generic;
    }
  }

  MobWrite create({required String subject, required String name, required int colour}) async {
    final failure = await _run(() => _api.post('/api/mob', body: {'subject': subject, 'name': name.trim(), 'colour': colour}, options: const ApiOptions(retries: 0)), acceptsShape: true);
    // The plan's cap answered: what this page drew (a start key) was out of date. Read it again so the key goes.
    if (failure == MobFailure.mobLimit || failure == MobFailure.mobLimitPro || failure == MobFailure.mobCeiling) {
      await _repo.refresh(force: true);
    }
    return failure;
  }

  MobWrite join({required String code, required String name, required int colour}) =>
      _run(() => _api.post('/api/mob/join', body: {'code': code, 'name': name.trim(), 'colour': colour}, options: const ApiOptions(retries: 0)), acceptsShape: true);

  MobWrite updateMe({String? name, int? colour, bool? showScore, bool? nudgesMuted}) => _run(
        () => _api.patch('/api/mob/me', body: _scoped({'name': ?name?.trim(), 'colour': ?colour, 'showScore': ?showScore, 'nudgesMuted': ?nudgesMuted})),
        acceptsShape: true,
      );

  /// A new invite revokes the previous code (P2).
  MobWrite newInvite() => _run(() => _api.post('/api/mob/invite', body: _scoped(), options: const ApiOptions(retries: 0)));

  MobWrite leave({String? block}) => _run(() => _api.post('/api/mob/leave', body: _scoped({'block': ?block}), options: const ApiOptions(retries: 0)), clears: true);

  MobWrite remove(String memberId) =>
      _run(() => _api.post('/api/mob/remove', body: _scoped({'memberId': memberId}), options: const ApiOptions(retries: 0)), acceptsShape: true);

  MobWrite report({required String memberId, required String reason, bool alsoLeave = false, bool block = false}) => _run(
        () => _api.post('/api/mob/report', body: _scoped({'memberId': memberId, 'reason': reason, 'alsoLeave': alsoLeave, 'block': block}), options: const ApiOptions(retries: 0)),
        clears: alsoLeave || block,
      );

  /// "Sit it with me": once a week, to the members who have not sat, who are never named (P6).
  MobWrite nudge() => _run(() => _api.post('/api/mob/nudge', body: _scoped(), options: const ApiOptions(retries: 0)));

  /// The received note was shown once; it does not come back.
  Future<void> nudgeSeen() async {
    try {
      await _api.post('/api/mob/nudge/seen', body: _scoped());
      await _repo.refresh(force: true);
    } on Object {
      // The line simply shows again next time.
    }
  }

  /// Pro: an extra paper on a chosen chapter and length. Returns the new paper's id, or why not.
  Future<(String?, MobFailure?)> createExtra({String? chapter, required int count}) async {
    try {
      final response = await _api.post('/api/mob/extra', body: _scoped({'chapter': ?chapter, 'count': count}), options: const ApiOptions(retries: 0));
      final made = MobExtraMade.fromJson(asJson(response.data));
      _repo.accept(response.data);
      await _repo.refresh(force: true);
      return (made.extraId, null);
    } on ApiError catch (e) {
      return (null, _failed(e));
    } on Object {
      return (null, MobFailure.generic);
    }
  }

  /// Pro: the chapters of this Mob's subject the bank can build an extra paper from, each with the
  /// longest paper it can really make (`GET /api/mob/extra?mob=`). A failure leaves the whole subject,
  /// which always works.
  Future<(MobChapters?, MobFailure?)> chapters() async {
    try {
      final response = await _api.get('/api/mob/extra', query: {'mob': ?mobId});
      return (MobChapters.fromJson(asJson(response.data)), null);
    } on ApiError catch (e) {
      return (null, _failed(e));
    } on Object {
      return (null, MobFailure.generic);
    }
  }

  /// The side-by-side of this week's paper, a past week, or an extra paper. A failure also reads
  /// the Mob again: what a plan may open can have changed since the page was drawn.
  Future<(MobCompare?, MobFailure?)> compare({String? week, String? extra}) async {
    try {
      final response = await _api.get('/api/mob/compare', query: {'mob': ?mobId, 'week': ?week, 'extra': ?extra});
      final compare = MobCompare.fromJson(asJson(response.data));
      // Opening the one free side-by-side uses it: the view reads again.
      await _repo.refresh(force: true);
      return (compare, null);
    } on ApiError catch (e) {
      await _repo.refresh(force: true);
      return (null, _failed(e));
    } on Object {
      return (null, MobFailure.generic);
    }
  }

  /// Pro: the weekly papers that closed.
  Future<(MobHistory?, MobFailure?)> history() async {
    try {
      final response = await _api.get('/api/mob/history', query: {'mob': ?mobId});
      return (MobHistory.fromJson(asJson(response.data)), null);
    } on ApiError catch (e) {
      return (null, _failed(e));
    } on Object {
      return (null, MobFailure.generic);
    }
  }

  /// The public invite read: subject and seats, never a member's name. Signed in, the reply also
  /// says who made the link.
  Future<(MobInvitePreview?, MobFailure?)> preview(String code) async {
    try {
      final response = await _api.get('/api/mob/join/$code');
      return (MobInvitePreview.fromJson(asJson(response.data)), null);
    } on ApiError catch (e) {
      if (e.status == 410) return (null, MobFailure.inviteExpired);
      if (e.kind == ApiErrorKind.notFound && !e.hasCode('MOB_DISABLED')) return (null, MobFailure.inviteInvalid);
      // A full Mob (MOB_FULL) and the paused links (JOIN_PAUSED) have their own words and screens.
      return (null, _failed(e));
    } on Object {
      return (null, MobFailure.generic);
    }
  }
}

final mobActionsProvider = Provider<MobActions>(MobActions.new);
