import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/models/study.dart';
import '../copy.dart';
import 'learn_store.dart';
import 'pending_event.dart';
import 'study_api.dart';

enum StartOutcome {
  started,
  dailyLimit,
  nothingDue,
  lessonNotRead,
  contentChanged,
  unavailable,
  offline,
  failed,
}

class StartResult {
  const StartResult(this.outcome, [this.run]);

  final StartOutcome outcome;
  final StudyRun? run;

  bool get started => outcome == StartOutcome.started;

  /// The plain line for a start that did not happen, or null when it started.
  String? get message => switch (outcome) {
    StartOutcome.started => null,
    StartOutcome.dailyLimit => LearnCopy.dailyNewLimit,
    StartOutcome.nothingDue => LearnCopy.nothingDue,
    StartOutcome.lessonNotRead => LearnCopy.lessonNotRead,
    StartOutcome.contentChanged => LearnCopy.contentChangedOpening,
    StartOutcome.unavailable => LearnCopy.disabledTitle,
    StartOutcome.offline => LearnCopy.connectToStart,
    StartOutcome.failed => LearnCopy.startFailed,
  };
}

/// Starts or resumes a study run. The same tap keeps the same `requestKey` until the server
/// answers, so a retry after a dropped connection cannot start a second run.
class RunStarter {
  RunStarter(this._api, this._store);

  final StudyApi _api;
  final LearnStore _store;
  final Map<String, String> _keys = {};

  /// [mode] is `recall` or `learn`; [unitId] focuses one lesson.
  Future<StartResult> start({required String mode, String? unitId}) async {
    final intent = '$mode:${unitId ?? '*'}';
    final key = _keys.putIfAbsent(intent, PendingEvent.newRequestKey);
    try {
      final run = await _api.startRun(
        requestKey: key,
        mode: mode,
        unitId: unitId,
      );
      _keys.remove(intent);
      await _store.putRun(run.id, run.raw);
      return StartResult(StartOutcome.started, run);
    } on ApiError catch (e) {
      if (e.isOffline) return const StartResult(StartOutcome.offline);
      // The server answered, so this intent is finished either way.
      _keys.remove(intent);
      if (e.hasCode(ApiCodes.dailyNewLimitReached))
        return const StartResult(StartOutcome.dailyLimit);
      if (e.hasCode(ApiCodes.nothingDue))
        return const StartResult(StartOutcome.nothingDue);
      if (e.hasCode('LESSON_NOT_READ'))
        return const StartResult(StartOutcome.lessonNotRead);
      if (e.hasCode(ApiCodes.studyContentChanged))
        return const StartResult(StartOutcome.contentChanged);
      if (e.hasCode('STUDY_RECALL_UNAVAILABLE') ||
          e.hasCode('STUDY_STORAGE_UNAVAILABLE')) {
        return const StartResult(StartOutcome.unavailable);
      }
      return const StartResult(StartOutcome.failed);
    }
  }
}

final runStarterProvider = Provider<RunStarter>(
  (ref) =>
      RunStarter(ref.watch(studyApiProvider), ref.watch(learnStoreProvider)),
);
