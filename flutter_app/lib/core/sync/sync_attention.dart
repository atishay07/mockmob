import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart' show nowProvider;
import 'outbox_repository.dart';

/// How long a write may wait for the network before the You tab says so.
const Duration syncStaleAfter = Duration(hours: 24);

/// True when the oldest write still waiting in [items] has waited longer than [syncStaleAfter].
bool syncIsStale(Iterable<OutboxItem> items, DateTime now) {
  for (final item in items) {
    if (now.difference(item.createdAt) > syncStaleAfter) return true;
  }
  return false;
}

/// The You tab's dot (BarBadges.youDot): a write has sat unsent for over 24 hours. It looks again
/// each time the outbox count changes, so it clears when the queue drains. False while the queue
/// cannot be read.
final syncStaleProvider = FutureProvider<bool>((ref) async {
  final count = ref.watch(outboxPendingCountProvider).value ?? 0;
  if (count == 0) return false;
  try {
    return syncIsStale(await ref.read(outboxRepositoryProvider).pending(), ref.read(nowProvider)());
  } on Object {
    return false;
  }
});
