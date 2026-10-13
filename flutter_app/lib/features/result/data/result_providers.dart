import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/analytics/analytics.dart';
import '../../../core/api/api.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/storage/prefs_store.dart';
import '../../../core/storage/storage.dart';
import '../../notifications/notifications.dart'
    show PrePromptMoment, prePromptDueAtProvider, prePromptDueProvider, reminderSchedulerProvider, reminderStateProvider;
import '../../rhythm/rhythm.dart'
    show CelebrationEvent, CelebrationScope, celebrationControllerProvider, rhythmPrefsProvider, rhythmVisibleProvider;
import '../model/recap_model.dart';

/// What the result screens render: the model when the attempt is known (from the detail read or
/// the cached list), plus the detail itself for keys and explanations.
class RecapData {
  const RecapData({this.model, this.attempt, this.detail, this.error, this.loading = false, this.fetchedAt, this.stale = false});

  final RecapModel? model;
  final Attempt? attempt;
  final AttemptDetail? detail;
  final ApiError? error;
  final bool loading;
  final DateTime? fetchedAt;

  /// A cached copy is showing because the read failed: label it with [fetchedAt].
  final bool stale;
}

/// When this phone received the acknowledgment for the attempt ("Saved on the server at ...").
final resultReceivedProvider = FutureProvider.autoDispose.family<PendingResult?, String>((ref, attemptId) async {
  try {
    return await ref.watch(pendingResultRepositoryProvider).find(attemptId);
  } on Object {
    return null;
  }
});

/// Questions of [attemptId] repaired on this phone (acknowledged by the server).
final _repairedIdsProvider = Provider.autoDispose.family<Set<String>, String>((ref, attemptId) {
  final records = ref.watch(repairLocalRecordsProvider).value ?? const <RepairLocalRecord>[];
  return {
    for (final r in records)
      if (r.attemptId == attemptId && r.isRepaired && r.isAcknowledged) r.questionId,
  };
});

/// The one composed read behind the sealed sheet, the recap cards and the full result.
final recapDataProvider = Provider.autoDispose.family<RecapData, String>((ref, attemptId) {
  final detailState = ref.watch(attemptDetailProvider(attemptId));
  final listState = ref.watch(attemptsRepositoryProvider);
  final cachedList = listState.value ?? const <Attempt>[];
  final detail = detailState.value;
  Attempt? attempt = detail?.attempt;
  if (attempt == null) {
    for (final a in cachedList) {
      if (a.id == attemptId) attempt = a;
    }
  }
  if (attempt == null) {
    return RecapData(error: detailState.error, loading: detailState.loading || !detailState.hasValue && detailState.error == null);
  }
  // The mock number, the first-mock variant and the first-mock token all count the student's
  // earlier papers. Until the attempts list has a value that count is unknown, so no model is
  // built (a later mock must never be shown as Mock 1) and the placeholder stays up.
  if (!listState.hasValue) {
    return RecapData(
      attempt: attempt,
      detail: detail,
      error: listState.error ?? detailState.error,
      loading: listState.error == null,
    );
  }
  final pending = ref.watch(resultReceivedProvider(attemptId)).value;
  final model = buildRecapModel(
    attempt: attempt,
    detail: detail,
    attempts: cachedList,
    repairedIds: ref.watch(_repairedIdsProvider(attemptId)),
    creditBalance: ref.watch(creditsRepositoryProvider.select((s) => s.value?.explanationBalance)),
    receivedAt: pending?.receivedAt,
    milestones: ref.watch(rhythmRepositoryProvider.select((s) => s.value?.milestones)) ?? const [],
  );
  return RecapData(
    model: model,
    attempt: attempt,
    detail: detail,
    error: detailState.error,
    loading: detailState.loading,
    fetchedAt: detailState.fetchedAt,
    stale: detailState.isStale,
  );
});

/// "Try again" on the result placeholder: reads the result and the list that numbers it again.
void retryRecapData(WidgetRef ref, String attemptId) {
  ref.read(attemptDetailProvider(attemptId).notifier).refresh(force: true);
  ref.read(attemptsRepositoryProvider.notifier).refresh(force: true);
}

/// The ritual settings of 5.6.1, read once per sealed sheet.
class RecapRitual {
  const RecapRitual({this.sheetsOpened = 0, this.openDirectly = false, this.skipHintShown = false, this.alreadyOpened = false});

  /// Sealed sheets opened before this one.
  final int sheetsOpened;

  /// You > Appearance > "Open results directly".
  final bool openDirectly;

  /// "Prefer to skip the reveal?" was already shown once.
  final bool skipHintShown;

  /// This result was opened before on this phone: a repeat visit goes to the full result.
  final bool alreadyOpened;

  /// The first three sheets open with the full swipe; from the fourth a tap fades it open.
  bool get decayed => sheetsOpened >= 3;

  /// The nudge plays on the very first sheet only.
  bool get firstEver => sheetsOpened == 0;
}

final recapRitualProvider = FutureProvider.autoDispose.family<RecapRitual, String>((ref, attemptId) async {
  final prefs = ref.watch(appPrefsProvider);
  try {
    final pending = await ref.watch(pendingResultRepositoryProvider).find(attemptId);
    return RecapRitual(
      sheetsOpened: await prefs.sheetsOpened(),
      openDirectly: await prefs.openResultsDirectly(),
      skipHintShown: await prefs.skipRevealHintShown(),
      alreadyOpened: pending?.isOpened ?? false,
    );
  } on Object {
    return const RecapRitual();
  }
});

/// Per-phone store for recap progress ("Continue recap, card 3 of 4").
final resultPrefsStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

String _progressKey(String userId, String attemptId) => 'recap_card_${userId}_$attemptId';

/// The furthest card reached on an unfinished recap (1 to 3), or null when finished or never
/// started.
final recapProgressProvider = FutureProvider.autoDispose.family<int?, String>((ref, attemptId) async {
  final user = ref.watch(userIdProvider) ?? 'none';
  try {
    final v = await ref.watch(resultPrefsStoreProvider).getInt(_progressKey(user, attemptId));
    return v == null || v < 1 || v > 3 ? null : v;
  } on Object {
    return null;
  }
});

/// Side effects of the result screens. Bookkeeping never breaks a screen: every write is
/// best-effort, because the result is already on display.
class ResultActions {
  ResultActions(this._ref);

  final Ref _ref;

  /// The sheet was opened: clears the Today slot and the Review dot, counts the ritual.
  Future<void> markOpened(String attemptId, {required String mode, required String variant}) async {
    try {
      await _ref.read(pendingResultRepositoryProvider).markOpened(attemptId);
    } on Object {
      // The dot clears on the next successful open.
    }
    try {
      await _ref.read(appPrefsProvider).incrementSheetsOpened();
    } on Object {
      // The ritual simply stays full one more time.
    }
    track(AnalyticsEvents.resultOpened, {'mode': mode, 'variant': variant});
  }

  /// The full result was shown: the result counts as opened, without counting a sheet ritual.
  Future<void> markSeen(String attemptId) async {
    try {
      final pending = await _ref.read(pendingResultRepositoryProvider).find(attemptId);
      if (pending != null && !pending.isOpened) await _ref.read(pendingResultRepositoryProvider).markOpened(attemptId);
    } on Object {
      // The dot clears on the next successful open.
    }
  }

  /// Records the card reached; card 4 completes the recap and clears the chip.
  Future<void> saveProgress(String attemptId, int card) async {
    final user = _ref.read(userIdProvider) ?? 'none';
    final store = _ref.read(resultPrefsStoreProvider);
    try {
      if (card >= 4) {
        await store.remove(_progressKey(user, attemptId));
      } else {
        final current = await store.getInt(_progressKey(user, attemptId)) ?? 0;
        if (card > current) await store.setInt(_progressKey(user, attemptId), card);
      }
    } on Object {
      // Without storage the chip simply does not appear.
    }
  }

  /// The first-mock token is shown for the server's `first_full_mock` milestone: record it with
  /// the rhythm module so it is a dated row, fired once, and never celebrated twice.
  Future<void> acknowledgeFirstMock(String attemptId, DateTime achievedAt) async {
    try {
      // Rhythm turned off means hidden everywhere: do not spend the moment unseen.
      await _ref.read(rhythmPrefsProvider.notifier).ensureLoaded();
      if (!_ref.read(rhythmVisibleProvider)) return;
      await _ref
          .read(celebrationControllerProvider.notifier)
          .celebrate(CelebrationEvent.milestone(RhythmMilestone(id: 'first_full_mock', achievedAt: achievedAt), scope: CelebrationScope.result(attemptId)));
    } on Object {
      // The row still shows; it may simply fade in again on the milestone screen.
    }
  }

  /// "Not now" on the recap's reminder row: counted exactly like the sheet's Not now (the time
  /// first, then the count), so the sheet's re-ask spacing (2, 4, 7, then every 10 days) holds
  /// from either entry point.
  Future<void> declineReminder() async {
    try {
      await _ref.read(appPrefsProvider).setLastPrePromptAt(_ref.read(nowProvider)());
      await _ref.read(reminderSchedulerProvider).prePromptDismissed();
      _ref.invalidate(prePromptDueProvider);
      _ref.invalidate(prePromptDueAtProvider);
    } on Object {
      // The row is already hidden for this visit; the rule simply counts one decline less.
    }
  }

  Future<void> markSkipHintShown() async {
    try {
      await _ref.read(appPrefsProvider).setSkipRevealHintShown(true);
    } on Object {
      // Shown again next time at worst.
    }
  }

  void track(String event, Map<String, Object?> props) {
    try {
      unawaited(_ref.read(analyticsClientProvider).track(event, props: props).catchError((_) => false));
    } on Object {
      // Usage data is optional and never blocks the student.
    }
  }
}

final resultActionsProvider = Provider<ResultActions>(ResultActions.new);

/// Whether the recap's reminder row shows at [moment] (spec 5.6.3). It follows the same policy as
/// the notifications module's sheet: [prePromptDueAtProvider] applies `shouldOfferPrePrompt`. At
/// [PrePromptMoment.afterResult] the row is due while reminders are still off and the spacing
/// since the last ask has passed (2, 4, 7, then every 10 days), so it comes back after a Not now
/// or a refusal and not only on the first result. An NTA mode result asks with
/// [PrePromptMoment.ntaMode], which is never due. One policy governs both entry points.
final reminderOfferProvider = FutureProvider.autoDispose.family<bool, PrePromptMoment>((ref, moment) async {
  try {
    return await ref.watch(prePromptDueAtProvider(moment).future);
  } on Object {
    return false;
  }
});

/// How many times the reminder ask was already put to the student, the same count the sheet
/// words itself by. 0 when it cannot be read.
final reminderAskCountProvider = FutureProvider.autoDispose<int>((ref) async {
  try {
    return (await ref.watch(reminderStateProvider.future)).prePromptAskCount;
  } on Object {
    return 0;
  }
});
