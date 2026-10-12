import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../repositories/session_draft_repository.dart';
import 'outbox_repository.dart';

/// Keys of work that the network has to carry (a session with unacknowledged answers or an
/// unsent submit). The outbox and the session draft are counted separately.
class PendingWorkRegistry extends Notifier<Set<String>> {
  @override
  Set<String> build() => const {};

  void set(String key, {required bool pending}) {
    if (pending == state.contains(key)) return;
    state = pending ? {...state, key} : ({...state}..remove(key));
  }
}

final pendingWorkRegistryProvider = NotifierProvider<PendingWorkRegistry, Set<String>>(PendingWorkRegistry.new);

/// True while anything is waiting to be sent: outbox writes, an unsent submit, or answers the
/// server has not acknowledged. Connectivity pings only while this is true.
final pendingWorkProvider = Provider<bool>((ref) {
  final outbox = ref.watch(outboxPendingCountProvider).value ?? 0;
  final submitOwed = ref.watch(latestSessionDraftProvider).value?.pendingSubmission ?? false;
  final live = ref.watch(pendingWorkRegistryProvider).isNotEmpty;
  return outbox > 0 || submitOwed || live;
});
