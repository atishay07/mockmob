// How solid a subject feels, for the subjects the onboarding sheet has no place for (Physics,
// History and the rest of the 15). The six onboarding subjects keep their confidence in the
// onboarding answers, where Today's first move reads it; these stay on this phone, per account.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/repositories/local_scope.dart' show userIdProvider;
import '../../../core/storage/prefs_store.dart';
import '../../onboarding/data/subjects.dart' show Confidence;

/// The store You keeps its own phone-only choices in. Replaced in tests.
final youPrefsStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

class ConfidenceStore extends Notifier<Map<String, Confidence>> {
  String? get _key {
    final user = ref.read(userIdProvider);
    return user == null ? null : 'you.confidence.$user';
  }

  @override
  Map<String, Confidence> build() {
    ref.watch(userIdProvider);
    _load();
    return const {};
  }

  Future<void> _load() async {
    final key = _key;
    if (key == null) return;
    try {
      final raw = await ref.read(youPrefsStoreProvider).getStringList(key) ?? const [];
      final loaded = <String, Confidence>{};
      for (final entry in raw) {
        final parts = entry.split(':');
        final level = parts.length == 2 ? Confidence.byName(parts[1]) : null;
        if (level != null) loaded[parts[0]] = level;
      }
      if (ref.mounted && loaded.isNotEmpty) state = {...loaded, ...state};
    } on Object {
      // Starts empty.
    }
  }

  Future<void> set(String subjectId, Confidence level) async {
    state = {...state, subjectId: level};
    final key = _key;
    if (key == null) return;
    try {
      await ref.read(youPrefsStoreProvider).setStringList(key, [for (final e in state.entries) '${e.key}:${e.value.name}']);
    } on Object {
      // Applies for this session.
    }
  }
}

final youConfidenceProvider = NotifierProvider<ConfidenceStore, Map<String, Confidence>>(ConfidenceStore.new);
