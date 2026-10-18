// What the student said about their range, kept on this phone per account (owner, 19 Oct, D109):
// nothing yet; "I don't know my range yet" (Today shows the way to an estimate from one full mock in
// each subject); they typed their own; or they took their mocks' estimate as their range. "Sit more
// mocks first" rests the estimate card until a newer full mock is scored.

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/auth/auth_state.dart';
import '../data/tools_store.dart' show toolsPrefsProvider, toolsStoreProvider;

enum RangeChoice { none, unknown, typed, accepted }

class RangeMemory {
  const RangeMemory({this.choice = RangeChoice.none, this.at, this.restedAt});

  final RangeChoice choice;

  /// When the choice was made.
  final DateTime? at;

  /// "Sit more mocks first": the estimate card rests until a full mock newer than this.
  final DateTime? restedAt;

  Map<String, Object?> toJson() => {
        'choice': choice.name,
        if (at != null) 'at': at!.millisecondsSinceEpoch,
        if (restedAt != null) 'rested': restedAt!.millisecondsSinceEpoch,
      };

  static RangeMemory fromJson(Object? raw) {
    if (raw is! Map) return const RangeMemory();
    DateTime? time(Object? v) => v is int ? DateTime.fromMillisecondsSinceEpoch(v) : null;
    final choice = RangeChoice.values.where((c) => c.name == raw['choice']).firstOrNull ?? RangeChoice.none;
    return RangeMemory(choice: choice, at: time(raw['at']), restedAt: time(raw['rested']));
  }

  @override
  bool operator ==(Object other) => other is RangeMemory && other.choice == choice && other.at == at && other.restedAt == restedAt;

  @override
  int get hashCode => Object.hash(choice, at, restedAt);
}

class RangeChoiceController extends AsyncNotifier<RangeMemory> {
  String? _user;

  static String keyFor(String userId) => 'mm.tools.range.v1.$userId';

  @override
  Future<RangeMemory> build() async {
    _user = ref.watch(authSnapshotProvider.select((a) => a.userId));
    final user = _user;
    if (user == null) return const RangeMemory();
    try {
      final raw = await ref.read(toolsPrefsProvider).getString(keyFor(user));
      if (raw != null) return RangeMemory.fromJson(jsonDecode(raw));
      // Nothing said yet: a range typed before this choice existed still counts as theirs.
      final saved = await ref.read(toolsStoreProvider).compass();
      return saved != null && saved.score.trim().isNotEmpty ? const RangeMemory(choice: RangeChoice.typed) : const RangeMemory();
    } on Object {
      return const RangeMemory();
    }
  }

  Future<void> _save(RangeMemory next) async {
    state = AsyncData(next);
    final user = _user;
    if (user == null) return;
    try {
      await ref.read(toolsPrefsProvider).setString(keyFor(user), jsonEncode(next.toJson()));
    } on Object {
      // Storage refused: the choice lasts this visit.
    }
  }

  DateTime _now() => ref.read(nowProvider)();

  /// "I don't know my range yet".
  Future<void> chooseUnknown() => _save(RangeMemory(choice: RangeChoice.unknown, at: _now()));

  /// The mocks' estimate (or the projection) is their range.
  Future<void> accept() => _save(RangeMemory(choice: RangeChoice.accepted, at: _now()));

  /// They typed their own range.
  Future<void> chooseTyped() => _save(RangeMemory(choice: RangeChoice.typed, at: _now()));

  /// Nothing said (their typed range was cleared).
  Future<void> clear() => _save(const RangeMemory());

  /// "Sit more mocks first".
  Future<void> rest() => _save(RangeMemory(choice: state.value?.choice ?? RangeChoice.none, at: state.value?.at, restedAt: _now()));
}

final rangeChoiceProvider = AsyncNotifierProvider<RangeChoiceController, RangeMemory>(RangeChoiceController.new);
