import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';

/// The share right the student last saw on the record, so the next look can say what moved. Held
/// for this app run and for this account only: a new account starts with nothing, and a record
/// with no earlier look says nothing about change.
class LastLook {
  const LastLook({required this.pct});

  final int pct;

  @override
  bool operator ==(Object other) => other is LastLook && other.pct == pct;

  @override
  int get hashCode => pct.hashCode;
}

class LastLookStore extends Notifier<LastLook?> {
  @override
  LastLook? build() {
    // A new account starts clean.
    ref.watch(authSnapshotProvider.select((s) => s.userId));
    return null;
  }

  void remember(int pct) {
    final next = LastLook(pct: pct);
    if (state != next) state = next;
  }
}

final lastLookProvider = NotifierProvider<LastLookStore, LastLook?>(LastLookStore.new);

/// What changed in the share right between two looks, in whole percentage points. Null when
/// either look has no share, or nothing moved.
int? shareChange(int? from, int? to) {
  if (from == null || to == null || from == to) return null;
  return to - from;
}

/// A rise this big (in points) earns Mobi's small hop; smaller moves are only said in words.
const int hopRise = 5;
