import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'nta_integrity.dart' show ntaPrefsProvider;

/// The A- / A+ text size of the exam paper (an app addition: exam centres have zoom). Four
/// steps of the question and option text, remembered on this phone.
class NtaTextStep extends Notifier<int> {
  static const List<double> scales = [0.9, 1.0, 1.15, 1.3];

  /// The most the paper text may grow in all: the phone's text size and the A+ step together.
  /// The bar and keys around the paper are held to the same 1.3x, so the paper never outgrows them.
  static const double maxEffective = 1.3;

  /// The step to build the paper's styles with, so that the step times the phone's own text scale
  /// ([system], which Flutter applies on top of the font size) never passes [maxEffective]. A- still
  /// shrinks the text at any phone size; A+ stops where the cap is reached.
  static double paperStep(double step, double system) => system <= 0 ? step : (step < maxEffective / system ? step : maxEffective / system);

  /// True while A+ would still make the paper text larger on this phone.
  static bool canGrowPaper(double step, double system) => step < scales.last && system * step < maxEffective - 1e-6;
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
