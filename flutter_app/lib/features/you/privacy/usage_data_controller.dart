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

  /// Waits for the consent record when it is not read yet. Without it the repository would write
  /// the unknown age band with the switch off, which turns an adult's opt-in off on the server with
  /// no message (you-05). Returns false when the record cannot be read; nothing is written then.
  Future<bool> _recordReady() async {
    final repo = ref.read(consentRepositoryProvider.notifier);
    if (ref.read(consentRepositoryProvider).isLoaded) return true;
    try {
      await repo.load();
    } on Object {
      // The state below says whether it worked.
    }
    return ref.mounted && ref.read(consentRepositoryProvider).isLoaded;
  }

  /// Turns usage data on or off. Off closes the gate before the call (the repository does it),
  /// so the switch reads off at once; the confirmation appears only after the server answers.
  /// Any failure, API or not, leaves the busy phase (a switch that stays disabled behind a
  /// spinner for good is the worse outcome).
  Future<void> setAllowed(bool allowed) async {
    if (state.busy) return;
    state = UsageDataUi(phase: allowed ? UsagePhase.enabling : UsagePhase.withdrawing);
    try {
      if (!await _recordReady()) {
        if (ref.mounted) state = UsageDataUi(phase: allowed ? UsagePhase.enableFailed : UsagePhase.unreached);
        return;
      }
      final result = await ref.read(consentRepositoryProvider.notifier).setAnalyticsAllowed(allowed);
      if (!ref.mounted) return;
      state = allowed ? const UsageDataUi(phase: UsagePhase.enabled) : UsageDataUi(phase: UsagePhase.withdrawn, deletedEvents: result.deletedEvents);
    } on Object catch (e) {
      if (!ref.mounted) return;
      if (allowed) {
        state = const UsageDataUi(phase: UsagePhase.enableFailed);
      } else {
        state = UsageDataUi(phase: e is ApiError && e.kind == ApiErrorKind.unavailable ? UsagePhase.deleteFailed : UsagePhase.unreached);
      }
    }
  }

  /// Saves the answer to "Are you 18 or older?". For No the repository writes `analyticsAllowed:false`
  /// with it; Yes and Prefer not to say keep an earlier "allowed" (D183).
  Future<void> changeAge(AgeBand band) async {
    if (state.busy) return;
    state = const UsageDataUi();
    try {
      await ref.read(consentRepositoryProvider.notifier).setAgeBand(band);
    } on Object {
      if (ref.mounted) state = const UsageDataUi(phase: UsagePhase.ageFailed);
    }
  }

  void clear() => state = const UsageDataUi();
}

final usageDataControllerProvider = NotifierProvider.autoDispose<UsageDataController, UsageDataUi>(UsageDataController.new);
