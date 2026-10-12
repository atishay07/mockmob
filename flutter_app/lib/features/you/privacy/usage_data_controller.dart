import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/models/consent.dart';
import '../../../core/repositories/consent_repository.dart';

/// What the usage-data card says about the last action. The consent record itself (age band and
/// the switch) always comes from [ConsentRepository]; this is only the story of one change.
enum UsagePhase {
  idle,

  /// Turning on: the switch stays off until the server acknowledges.
  enabling,
  enableFailed,

  /// Turning off: collection is already stopped; the server call is in flight.
  withdrawing,

  /// The server acknowledged turning usage data on.
  enabled,

  /// The server acknowledged the withdrawal. [UsageDataUi.deletedEvents] says what it deleted.
  withdrawn,

  /// A 503: the choice was saved but deleting earlier data failed.
  deleteFailed,

  /// No answer from the server: collection is off here, the server call did not land.
  unreached,
  ageFailed,
}

class UsageDataUi {
  const UsageDataUi({this.phase = UsagePhase.idle, this.deletedEvents});

  final UsagePhase phase;
  final int? deletedEvents;

  bool get busy => phase == UsagePhase.enabling || phase == UsagePhase.withdrawing;
}

class UsageDataController extends Notifier<UsageDataUi> {
  @override
  UsageDataUi build() => const UsageDataUi();

  /// Turns usage data on or off. Off closes the gate before the call (the repository does it),
  /// so the switch reads off at once; the confirmation appears only after the server answers.
  Future<void> setAllowed(bool allowed) async {
    if (state.busy) return;
    state = UsageDataUi(phase: allowed ? UsagePhase.enabling : UsagePhase.withdrawing);
    try {
      final result = await ref.read(consentRepositoryProvider.notifier).setAnalyticsAllowed(allowed);
      if (!ref.mounted) return;
      state = allowed ? const UsageDataUi(phase: UsagePhase.enabled) : UsageDataUi(phase: UsagePhase.withdrawn, deletedEvents: result.deletedEvents);
    } on ApiError catch (e) {
      if (!ref.mounted) return;
      if (allowed) {
        state = const UsageDataUi(phase: UsagePhase.enableFailed);
      } else {
        state = UsageDataUi(phase: e.kind == ApiErrorKind.unavailable ? UsagePhase.deleteFailed : UsagePhase.unreached);
      }
    }
  }

  /// Saves the answer to "Are you 18 or older?". For No and Prefer not to say the repository
  /// writes `analyticsAllowed:false` with it.
  Future<void> changeAge(AgeBand band) async {
    if (state.busy) return;
    state = const UsageDataUi();
    try {
      await ref.read(consentRepositoryProvider.notifier).setAgeBand(band);
    } on ApiError {
      if (ref.mounted) state = const UsageDataUi(phase: UsagePhase.ageFailed);
    }
  }

  void clear() => state = const UsageDataUi();
}

final usageDataControllerProvider = NotifierProvider.autoDispose<UsageDataController, UsageDataUi>(UsageDataController.new);
