import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/storage/storage_providers.dart';
import 'learn_store.dart';
import 'study_api.dart';

/// The offline switches of Learn: which subjects keep the lessons the student opens on this
/// phone, and how much each one uses. A lesson is only ever fetched when the student opens it
/// (the server records that as a study exposure), so "kept" means opened lessons stay.
class OfflineLearnState {
  const OfflineLearnState({this.kept = const {}, this.sizes = const {}});

  final Set<String> kept;
  final Map<String, int> sizes;

  int sizeOf(String subject) => sizes[subject] ?? 0;
}

class OfflineLearn extends AsyncNotifier<OfflineLearnState> {
  @override
  Future<OfflineLearnState> build() async {
    final kept = await ref.read(appPrefsProvider).offlineLearnSubjects();
    final sizes = await ref.read(learnStoreProvider).sizeBySubject();
    return OfflineLearnState(kept: kept, sizes: sizes);
  }

  Future<void> setKept(String subject, {required bool keep}) async {
    final current = state.value ?? const OfflineLearnState();
    final kept = {...current.kept};
    if (keep) {
      kept.add(subject);
    } else {
      kept.remove(subject);
      await ref.read(learnStoreProvider).dropSubject(subject);
    }
    await ref.read(appPrefsProvider).setOfflineLearnSubjects(kept);
    state = AsyncData(OfflineLearnState(kept: kept, sizes: await ref.read(learnStoreProvider).sizeBySubject()));
  }

  Future<void> refreshSizes() async {
    final current = state.value;
    if (current == null || !ref.mounted) return;
    final sizes = await ref.read(learnStoreProvider).sizeBySubject();
    if (ref.mounted) state = AsyncData(OfflineLearnState(kept: current.kept, sizes: sizes));
  }
}

final offlineLearnProvider = AsyncNotifierProvider<OfflineLearn, OfflineLearnState>(OfflineLearn.new);

/// A lesson and where it came from.
class LessonLoad {
  const LessonLoad({required this.json, required this.fromPhone});

  final Json json;

  /// True when the network could not be reached and the kept copy is showing.
  final bool fromPhone;
}

/// Opens a lesson: from the server when it can be reached (and keeps it when the subject is
/// kept for offline), otherwise from the copy on this phone. A lesson that was changed on the
/// server replaces the kept copy, so a stale version is never shown as current.
final lessonProvider = FutureProvider.autoDispose.family<LessonLoad, String>(retry: (count, error) => null, (ref, id) async {
  // Read everything up front: the screen can leave while the lesson is still loading.
  final store = ref.read(learnStoreProvider);
  final api = ref.read(studyApiProvider);
  final prefs = ref.read(appPrefsProvider);
  final offline = ref.read(offlineLearnProvider.notifier);
  final known = ref.read(networkStatusProvider) == NetworkStatus.offline;
  if (known) {
    final kept = await store.lesson(id);
    if (kept != null) return LessonLoad(json: kept.json, fromPhone: true);
  }
  try {
    final json = await api.unit(id);
    final subject = asString(json['subject']);
    final keptSubjects = await prefs.offlineLearnSubjects();
    if (subject != null && keptSubjects.contains(subject)) {
      await store.putLesson(json);
      unawaited(offline.refreshSizes());
    } else {
      // A lesson that is not kept leaves no copy behind, so changed content cannot linger.
      await store.dropLesson(id);
    }
    return LessonLoad(json: json, fromPhone: false);
  } on ApiError catch (e) {
    if (e.kind == ApiErrorKind.notFound) {
      await store.dropLesson(id);
      rethrow;
    }
    if (e.isRetryable) {
      final kept = await store.lesson(id);
      if (kept != null) return LessonLoad(json: kept.json, fromPhone: true);
    }
    rethrow;
  }
});
