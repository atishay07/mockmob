import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'nta_integrity.dart' show ntaPrefsProvider;

/// The A- / A+ text size of the exam paper (an app addition: exam centres have zoom). Four
/// steps of the question and option text, remembered on this phone.
class NtaTextStep extends Notifier<int> {
  static const List<double> scales = [0.9, 1.0, 1.15, 1.3];
  static const String _key = 'nta.textStep';

  @override
  int build() {
    unawaited(_load());
    return 1;
  }

  Future<void> _load() async {
    try {
      final v = await ref.read(ntaPrefsProvider).getInt(_key);
      if (v != null && ref.mounted) state = v.clamp(0, scales.length - 1);
    } on Object {
      // The default size is fine.
    }
  }

  double get scale => scales[state];
  bool get canShrink => state > 0;
  bool get canGrow => state < scales.length - 1;

  void step(int delta) {
    final next = (state + delta).clamp(0, scales.length - 1);
    if (next == state) return;
    state = next;
    unawaited(ref.read(ntaPrefsProvider).setInt(_key, next).catchError((Object _) {}));
  }
}

final ntaTextStepProvider = NotifierProvider<NtaTextStep, int>(NtaTextStep.new);
