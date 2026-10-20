// The den's data and the v3 actions. The den reads the same `GET /api/mob` the old Mob page reads
// (MobRepository, cached, refreshed on focus and pull); v3 is its `v3` object. Mutations that answer
// with the `GET` shape are shown at once (MobRepository.accept); others refresh.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api.dart';
import '../../data/mob_models.dart';
import '../../data/mob_repository.dart';
import '../mob_v3_flags.dart';
import 'mob_v3_api.dart';
import 'mob_v3_models.dart';

/// What the den draws: the old Mob (id, subject, week paper, invite, members' old fields) and v3.
class DenView {
  const DenView({required this.mob, required this.v3});

  /// Null: no Mob yet (D0).
  final Mob? mob;
  final MobV3 v3;

  String get mobId => mob?.id ?? '';
  String get subjectName => mob?.subjectName ?? '';
  bool get alone => v3.members.length <= 1;
}

/// The v3 den when the app flag is on and the server sent `v3`; else null (today's Mob shows).
final denViewProvider = Provider<DenView?>((ref) {
  if (!ref.watch(mobV3EnabledProvider)) return null;
  final read = ref.watch(mobRepositoryProvider).value;
  if (read == null) return null;
  final v3 = read.v3;
  // The server sends v3 inside the Mob, so a student with no Mob gets none: when the server says
  // `v3Available`, the no-Mob state is the v3 start (D0) all the same.
  if (v3 == null) return read.serverV3 ? const DenView(mob: null, v3: MobV3(name: MobV3Name(text: ''))) : null;
  return DenView(mob: read.mob, v3: v3);
});

/// True when the Mob tab should draw the v3 screens for this read.
bool showsV3(Ref ref, MobRead? read) => ref.read(mobV3EnabledProvider) && (read?.serverV3 ?? false);

class MobV3Actions {
  MobV3Actions(this.ref);

  final Ref ref;

  MobV3Api get api => ref.read(mobV3ApiProvider);
  MobRepository get _repo => ref.read(mobRepositoryProvider.notifier);
  String get mobId => ref.read(mobRepositoryProvider).value?.mob?.id ?? _repo.selectedId ?? '';

  Future<void> refresh() => _repo.refresh(force: true);

  Future<void> createMob({required String subject, required String name, required int colour, required int nameKey, required FoldKey fold}) async {
    _repo.accept(await api.createMob(subject: subject, name: name, colour: colour, nameKey: nameKey, fold: fold));
  }

  Future<void> join({required String code, required String name, required int colour, required FoldKey fold}) async {
    _repo.accept(await api.join(code: code, name: name, colour: colour, fold: fold));
  }

  Future<void> settings({bool? showPodium, int? nameKey}) async {
    _repo.accept(await api.settings(mob: mobId, showPodium: showPodium, nameKey: nameKey));
  }

  Future<void> stepOut(bool on) async {
    _repo.accept(await api.stepOut(mob: mobId, on: on));
  }

  Future<void> sitAs(FoldKey fold) async {
    await api.profile(fold);
    await refresh();
  }

  Future<MobGame> openGame({required GameFormat format, required GameMode mode, required int count, String? chapter, String? rematchOf, int? minutes}) async {
    final g = await api.openGame(mob: mobId, format: format, mode: mode, count: count, chapter: chapter, rematchOf: rematchOf, minutes: minutes);
    await refresh();
    return g;
  }

  /// Stickers are spaced 3 s apart on the phone (spec 2.5).
  DateTime? _lastSticker;
  Future<bool> sticker(StickerKind kind, {String? game}) async {
    final now = DateTime.now();
    if (_lastSticker != null && now.difference(_lastSticker!) < const Duration(seconds: 3)) return false;
    _lastSticker = now;
    await api.sticker(mob: mobId, game: game, kind: kind);
    return true;
  }

  Future<int?> passMic(String to) => api.mic(mob: mobId, to: to);

  Future<void> seen(List<String> keys) async {
    try {
      await api.seen(keys);
    } on ApiError {
      // A moment that could not be marked plays again next time: harmless.
    }
  }
}

final mobV3ActionsProvider = Provider<MobV3Actions>(MobV3Actions.new);

/// The personal chain (`GET /api/me/chain`).
class ChainRepository extends AsyncNotifier<ChainState> {
  @override
  Future<ChainState> build() => ref.read(mobV3ApiProvider).chain();

  Future<void> setHidden(bool hidden) async => state = AsyncData(await ref.read(mobV3ApiProvider).chainHidden(hidden));
  Future<void> pause(List<String> days) async => state = AsyncData(await ref.read(mobV3ApiProvider).pause(days));
  Future<void> unpause(List<String> days) async => state = AsyncData(await ref.read(mobV3ApiProvider).unpause(days));
}

final chainProvider = AsyncNotifierProvider<ChainRepository, ChainState>(ChainRepository.new);

/// The shelf (`GET /api/mob/shelf`).
final shelfProvider = FutureProvider.autoDispose<Shelf>((ref) => ref.read(mobV3ApiProvider).shelf());
