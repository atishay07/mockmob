import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/models/study.dart';
import '../models/run_item.dart';
import 'learn_store.dart';
import 'pending_event.dart';
import 'study_api.dart';

enum RunLoad {
  loading,
  ready,

  /// The run is gone or could not be opened.
  unavailable,

  /// No network and no copy of this run on the phone.
  offlineMissing,

  /// `STUDY_CONTENT_CHANGED` or an `invalidated` run: open the new lesson instead.
  changed,
}

/// A line the run screen shows under the card.
enum RunNotice { none, connectToReveal, connectToCheck, queuedOffline, sendFailed }

class RunUiState {
  const RunUiState({
    this.load = RunLoad.loading,
    this.run,
    this.pending,
    this.sending = false,
    this.notice = RunNotice.none,
    this.ackedAt,
    this.replacements = const [],
  });

  final RunLoad load;
  final StudyRun? run;

  /// The one event on this phone that the server has not acknowledged.
  final PendingEvent? pending;
  final bool sending;
  final RunNotice notice;

  /// When the server last acknowledged an event in this session of the screen.
  final DateTime? ackedAt;

  /// The lessons to open when the run was invalidated.
  final List<StudyUnitView> replacements;

  RunUiState copyWith({
    RunLoad? load,
    StudyRun? run,
    PendingEvent? pending,
    bool clearPending = false,
    bool? sending,
    RunNotice? notice,
    DateTime? ackedAt,
    List<StudyUnitView>? replacements,
  }) =>
      RunUiState(
        load: load ?? this.load,
        run: run ?? this.run,
        pending: clearPending ? null : (pending ?? this.pending),
        sending: sending ?? this.sending,
        notice: notice ?? this.notice,
        ackedAt: ackedAt ?? this.ackedAt,
        replacements: replacements ?? this.replacements,
      );
}

/// One study run on screen. Every step is written to the phone before it is sent and reused
/// until the server acknowledges it, so killing the app mid-step never sends it twice. Only
/// one event per run waits at a time: a second step cannot target a revision that does not
/// exist yet.
class RunController extends Notifier<RunUiState> {
  RunController(this.runId);

  final String runId;
  bool _busy = false;
  bool _conflictRetried = false;

  // Read once so a send that outlives the screen can still finish and clear its pending event.
  late StudyApi _api;
  late LearnStore _store;

  @override
  RunUiState build() {
    _api = ref.read(studyApiProvider);
    _store = ref.read(learnStoreProvider);
    ref.listen(networkRestoredProvider, (previous, next) {
      if (next is AsyncData) unawaited(flush());
    });
    scheduleMicrotask(load);
    return const RunUiState();
  }

  Future<void> load() async {
    final cachedJson = await _store.run(runId);
    final stored = await _store.pending(runId);
    if (!ref.mounted) return;
    final cached = cachedJson == null ? null : StudyRun.fromJson(cachedJson);
    if (cached != null) state = RunUiState(load: RunLoad.ready, run: cached, pending: stored);
    try {
      final fresh = await _api.run(runId);
      if (!ref.mounted) return;
      await _adopt(fresh, stored);
    } on ApiError catch (e) {
      if (!ref.mounted) return;
      if (e.hasCode(ApiCodes.studyContentChanged)) {
        await _settleChanged(const []);
      } else if (cached != null && e.isRetryable) {
        state = state.copyWith(notice: stored == null ? RunNotice.none : RunNotice.queuedOffline);
      } else if (e.isOffline) {
        state = state.copyWith(load: RunLoad.offlineMissing);
      } else {
        state = state.copyWith(load: RunLoad.unavailable);
      }
    }
  }

  Future<void> _adopt(StudyRun fresh, PendingEvent? stored) async {
    if (fresh.isInvalidated) {
      await _settleChanged(fresh.units);
      return;
    }
    var pending = stored;
    // A pending event aimed at an older revision was already applied (or overtaken): drop it.
    if (pending != null && (pending.expectedRevision != fresh.revision || !fresh.isActive)) {
      await _store.clearPending(runId);
      pending = null;
    }
    await _cacheRun(fresh);
    state = RunUiState(load: RunLoad.ready, run: fresh, pending: pending, ackedAt: state.ackedAt);
    if (pending != null) unawaited(_send(pending));
  }

  Future<void> _cacheRun(StudyRun run) async {
    if (run.isActive) {
      await _store.putRun(runId, run.raw);
    } else {
      await _store.dropRun(runId);
    }
  }

  Future<void> _settleChanged(List<StudyUnitView> units) async {
    await _store.clearPending(runId);
    await _store.dropRun(runId);
    if (ref.mounted) state = RunUiState(load: RunLoad.changed, replacements: units);
  }

  // What the student does.

  Future<void> reveal() => _act('reveal');

  Future<void> answer(Object value, {bool assisted = false}) => _act('answer', value: value, assisted: assisted);

  Future<void> rate(int rating) => _act('rate', rating: rating);

  /// Moves on after feedback, or past a lesson block.
  Future<void> advance() => _act('continue');

  /// Sends the waiting event again ("Try again", or the network came back).
  Future<void> flush() async {
    final pending = state.pending;
    if (pending != null && !_busy) await _send(pending);
  }

  Future<void> _act(String type, {Object? value, int? rating, bool assisted = false}) async {
    final run = state.run;
    final item = run?.currentItem;
    if (run == null || item == null || !run.isActive || state.pending != null || _busy) return;
    final event = PendingEvent.create(
      expectedRevision: run.revision,
      itemId: item.id,
      type: type,
      value: value,
      rating: rating,
      assisted: assisted,
    );
    if (!event.canWaitOffline && ref.read(networkStatusProvider) == NetworkStatus.offline) {
      state = state.copyWith(notice: type == 'reveal' ? RunNotice.connectToReveal : RunNotice.connectToCheck);
      return;
    }
    _conflictRetried = false;
    await _store.putPending(runId, event);
    state = state.copyWith(pending: event, notice: RunNotice.none);
    await _send(event);
  }

  Future<void> _send(PendingEvent event) async {
    if (_busy) return;
    _busy = true;
    state = state.copyWith(sending: true, notice: RunNotice.none);
    try {
      final run = await _api.sendEvent(runId, event);
      await _store.clearPending(runId);
      await _cacheRun(run);
      if (!ref.mounted) return;
      if (run.isInvalidated) {
        await _settleChanged(run.units);
        return;
      }
      state = RunUiState(load: RunLoad.ready, run: run, ackedAt: ref.read(nowProvider)());
    } on ApiError catch (e) {
      if (ref.mounted) await _onSendError(event, e);
    } finally {
      _busy = false;
    }
  }

  Future<void> _onSendError(PendingEvent event, ApiError e) async {
    if (e.hasCode(ApiCodes.studyContentChanged)) {
      await _settleChanged(const []);
      return;
    }
    final drifted = e.hasCode(ApiCodes.revisionConflict) ||
        e.hasCode(ApiCodes.stepConflict) ||
        e.hasCode(ApiCodes.idempotencyConflict) ||
        e.kind == ApiErrorKind.validation;
    if (drifted) {
      await _recover(event);
      return;
    }
    if (event.canWaitOffline) {
      // Kept on the phone and sent again later with the same key.
      state = state.copyWith(sending: false, notice: e.isOffline ? RunNotice.queuedOffline : RunNotice.sendFailed);
      return;
    }
    await _store.clearPending(runId);
    state = state.copyWith(
      sending: false,
      clearPending: true,
      notice: e.isOffline
          ? (event.type == 'reveal' ? RunNotice.connectToReveal : RunNotice.connectToCheck)
          : RunNotice.sendFailed,
    );
  }

  /// A conflict: read the run again and, once, send the step again at the current revision when
  /// it still applies. The student sees nothing unless that fails too.
  Future<void> _recover(PendingEvent event) async {
    try {
      final fresh = await _api.run(runId);
      if (!ref.mounted) return;
      if (fresh.isInvalidated) {
        await _settleChanged(fresh.units);
        return;
      }
      await _store.clearPending(runId);
      await _cacheRun(fresh);
      if (!_conflictRetried && _applies(fresh, event)) {
        _conflictRetried = true;
        final again = event.withFreshKey(fresh.revision);
        await _store.putPending(runId, again);
        state = RunUiState(load: RunLoad.ready, run: fresh, pending: again);
        _busy = false;
        await _send(again);
        return;
      }
      state = RunUiState(load: RunLoad.ready, run: fresh, ackedAt: state.ackedAt);
    } on ApiError catch (e) {
      if (!ref.mounted) return;
      state = state.copyWith(sending: false, notice: e.isOffline ? RunNotice.queuedOffline : RunNotice.sendFailed);
    }
  }

  static bool _applies(StudyRun run, PendingEvent event) {
    final item = run.currentItem;
    if (item == null || !run.isActive || item.id != event.itemId) return false;
    return switch (event.type) {
      'reveal' => !run.revealed && item.isSelfRated,
      'answer' => !run.revealed && item.isChecked,
      'rate' => run.revealed && item.isSelfRated,
      'continue' => (run.revealed && !item.isSelfRated) || (run.isLearn && item.isReading),
      _ => false,
    };
  }
}

final runControllerProvider = NotifierProvider.autoDispose.family<RunController, RunUiState, String>(RunController.new);
