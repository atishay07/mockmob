// The Mob v3 routes (MOB-BUILD-SPEC-V3 section 3.2), behind one interface so the screens never know
// whether the real server or the fixture server answers. Every failure is an [ApiError] whose `code`
// is the server's (START_USED, GAME_CLOSED...); `MobV3Copy.error` turns it into the sentence.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api.dart';
import '../../../../core/models/json_helpers.dart';
import '../mob_v3_flags.dart';
import 'mob_v3_fake_server.dart';
import 'mob_v3_models.dart';

abstract class MobV3Api {
  /// `GET /api/mob?mob=` (the old keys plus `v3`), raw, for the Mob repository to parse.
  Future<Object?> den({String? mob});

  /// `POST /api/mob` with a name from the list and a Fold. Returns the `GET` shape.
  Future<Object?> createMob({required String subject, required String name, required int colour, required int nameKey, required FoldKey fold});

  /// `GET /api/mob/join/[code]`.
  Future<JoinPreview> joinPreview(String code);

  /// `POST /api/mob/join`. Returns the `GET` shape.
  Future<Object?> join({required String code, required String name, required int colour, required FoldKey fold});

  /// `POST /api/mob/invite`.
  Future<InviteV3> invite(String mob);

  /// `PATCH /api/mob/settings`. Returns the `GET` shape.
  Future<Object?> settings({required String mob, bool? showPodium, int? nameKey});

  /// `PATCH /api/mob/me` with `{share_study_time}` (Mob hours, default off). Returns the `GET` shape.
  Future<Object?> studyShare({required String mob, required bool on});

  /// `PUT /api/mob/profile`.
  Future<void> profile(FoldKey fold, {FoldFinish finish = FoldFinish.plain});

  Future<Shelf> shelf();

  /// [minutes]: a race's length (5 or 10). A mock sends neither count nor minutes.
  Future<MobGame> openGame({required String mob, required GameFormat format, required GameMode mode, required int count, String? chapter, String? rematchOf, int? minutes});
  Future<MobGame> game(String id);
  Future<RunStart> run(String id);
  Future<AnswerResult> answer(String id, {required int q, required int pick});
  Future<RunFinish> finish(String id);
  Future<Podium> podium(String id);
  Future<Review> review(String id);

  /// Live rooms (Phase B, spec 3.2 and 4.2): the ticket that admits you to the room's private channel,
  /// the host's start (Go lands 4 s later on the server clock) and the host's cancel (lobby only).
  Future<RoomTicket> roomTicket(String id);
  Future<RoomStartAck> roomStart(String id);
  Future<void> roomCancel(String id);

  /// L-55: presence is the server's. `here` on joining, `ready` on I'm ready, `left` on leaving, and `here`
  /// or `ready` again every 20 s while the room is on screen. The server broadcasts `presence {m, st}`.
  /// Returns the roster the server saw in the last 45 s (member id to `here` or `ready`).
  Future<Map<String, String>> roomPresence(String id, String st);

  Future<void> sticker({required String mob, String? game, required StickerKind kind});
  Future<int?> mic({required String mob, required String to});
  Future<Object?> stepOut({required String mob, required bool on});

  Future<FixStart> fixStart({required String game, required int q, required String stage});
  Future<FixAnswer> fixAnswer({required String game, required int q, required String stage, required int pick});

  Future<void> seen(List<String> keys);

  Future<ChainState> chain();
  Future<ChainState> chainHidden(bool hidden);
  Future<ChainState> pause(List<String> days);
  Future<ChainState> unpause(List<String> days);
}

class HttpMobV3Api implements MobV3Api {
  HttpMobV3Api(this._api);

  final ApiClient _api;

  Json _j(ApiResponse r) => asJson(r.data);

  @override
  Future<Object?> den({String? mob}) async => (await _api.get('/api/mob', query: {'mob': ?mob})).data;

  @override
  Future<Object?> createMob({required String subject, required String name, required int colour, required int nameKey, required FoldKey fold}) async =>
      (await _api.post('/api/mob', body: {'subject': subject, 'name': name, 'colour': colour, 'nameKey': nameKey, 'fold': fold.name})).data;

  @override
  Future<JoinPreview> joinPreview(String code) async => JoinPreview.fromJson(_j(await _api.get('/api/mob/join/${Uri.encodeComponent(code)}')));

  @override
  Future<Object?> join({required String code, required String name, required int colour, required FoldKey fold}) async =>
      (await _api.post('/api/mob/join', body: {'code': code, 'name': name, 'colour': colour, 'fold': fold.name})).data;

  @override
  Future<InviteV3> invite(String mob) async => InviteV3.fromJson(_j(await _api.post('/api/mob/invite', body: {'mob': mob})));

  @override
  Future<Object?> studyShare({required String mob, required bool on}) async =>
      (await _api.patch('/api/mob/me', body: {'mob': mob, 'share_study_time': on})).data;

  @override
  Future<Object?> settings({required String mob, bool? showPodium, int? nameKey}) async =>
      (await _api.patch('/api/mob/settings', body: {'mob': mob, 'showPodium': ?showPodium, 'nameKey': ?nameKey})).data;

  @override
  Future<void> profile(FoldKey fold, {FoldFinish finish = FoldFinish.plain}) async {
    await _api.put('/api/mob/profile', body: {'fold': fold.name, 'finish': finish.name});
  }

  @override
  Future<Shelf> shelf() async => Shelf.fromJson(_j(await _api.get('/api/mob/shelf')));

  @override
  Future<MobGame> openGame({required String mob, required GameFormat format, required GameMode mode, required int count, String? chapter, String? rematchOf, int? minutes}) async =>
      MobGame.fromEnvelope(_j(await _api.post('/api/mob/game', body: switch (format) {
        // A race is timed: its length, not a count. The server sizes the pool.
        GameFormat.race => {'mob': mob, 'format': 'race', 'mode': mode.name, 'minutes': minutes ?? 5, 'chapter': chapter},
        // Full mock together: the whole subject, always the 24-hour window.
        GameFormat.mock => {'mob': mob, 'format': 'mock', 'mode': 'async'},
        _ => {
            'mob': mob,
            'format': format.name,
            'mode': mode.name,
            'count': count,
            'chapter': chapter,
            'rematchOf': ?rematchOf,
          },
      })));

  @override
  Future<MobGame> game(String id) async => MobGame.fromEnvelope(_j(await _api.get('/api/mob/game/$id')));

  @override
  Future<RunStart> run(String id) async => RunStart.fromJson(_j(await _api.post('/api/mob/game/$id/run', body: const <String, Object?>{})));

  @override
  Future<AnswerResult> answer(String id, {required int q, required int pick}) async => AnswerResult.fromJson(_j(await _api.post('/api/mob/game/$id/answer', body: {'q': q, 'pick': pick})));

  @override
  Future<RunFinish> finish(String id) async => RunFinish.fromJson(_j(await _api.post('/api/mob/game/$id/finish', body: const <String, Object?>{})));

  @override
  Future<Podium> podium(String id) async => Podium.fromJson(_j(await _api.get('/api/mob/game/$id/podium')));

  @override
  Future<Review> review(String id) async => Review.fromJson(_j(await _api.get('/api/mob/game/$id/review')));

  @override
  Future<RoomTicket> roomTicket(String id) async => RoomTicket.fromJson(_j(await _api.post('/api/mob/game/$id/room/ticket', body: const <String, Object?>{})));

  @override
  Future<RoomStartAck> roomStart(String id) async => RoomStartAck.fromJson(_j(await _api.post('/api/mob/game/$id/room/start', body: const <String, Object?>{})));

  @override
  Future<void> roomCancel(String id) async {
    await _api.post('/api/mob/game/$id/room/cancel', body: const <String, Object?>{});
  }

  @override
  Future<Map<String, String>> roomPresence(String id, String st) async {
    final j = _j(await _api.post('/api/mob/game/$id/room/presence', body: {'st': st}, options: const ApiOptions(retries: 0)));
    return GameRoom.rosterOf(j['roster']);
  }

  @override
  Future<void> sticker({required String mob, String? game, required StickerKind kind}) async {
    await _api.post('/api/mob/sticker', body: {'mob': mob, 'game': ?game, 'kind': kind.wire});
  }

  @override
  Future<int?> mic({required String mob, required String to}) async => asInt(_j(await _api.post('/api/mob/mic', body: {'mob': mob, 'to': to}))['micsToGive']);

  @override
  Future<Object?> stepOut({required String mob, required bool on}) async => (await _api.post('/api/mob/step-out', body: {'mob': mob, 'on': on})).data;

  @override
  Future<FixStart> fixStart({required String game, required int q, required String stage}) async =>
      FixStart.fromJson(_j(await _api.post('/api/mob/fix/start', body: {'game': game, 'q': q, 'stage': stage})));

  @override
  Future<FixAnswer> fixAnswer({required String game, required int q, required String stage, required int pick}) async =>
      FixAnswer.fromJson(_j(await _api.post('/api/mob/fix/answer', body: {'game': game, 'q': q, 'stage': stage, 'pick': pick})));

  @override
  Future<void> seen(List<String> keys) async {
    if (keys.isEmpty) return;
    await _api.post('/api/mob/seen', body: {'keys': keys});
  }

  @override
  Future<ChainState> chain() async => ChainState.fromJson(_j(await _api.get('/api/me/chain')));

  @override
  Future<ChainState> chainHidden(bool hidden) async => ChainState.fromJson(_j(await _api.patch('/api/me/chain', body: {'hidden': hidden})));

  @override
  Future<ChainState> pause(List<String> days) async => ChainState.fromJson(_j(await _api.post('/api/me/chain/pause', body: {'days': days})));

  @override
  Future<ChainState> unpause(List<String> days) async => ChainState.fromJson(_j(await _api.delete('/api/me/chain/pause', body: {'days': days})));
}

/// One fixture server per app run, so a game played in fixture mode is still there on the podium.
/// Demo builds get the 'heavy' scenario's arrival (a friend joins and sends a sticker a few seconds in).
final mobV3FakeServerProvider = Provider<MobV3FakeServer>((ref) => MobV3FakeServer(scenario: MobV3Flags.scenarioByDefine, billing: MobV3Flags.billingByDefine, arrivals: true));

final mobV3ApiProvider = Provider<MobV3Api>((ref) {
  if (ref.watch(mobV3FixturesProvider)) return ref.watch(mobV3FakeServerProvider);
  return HttpMobV3Api(ref.watch(apiClientProvider));
});
