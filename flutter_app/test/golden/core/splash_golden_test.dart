import 'package:mockmob/core/router/splash_screen.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import 'night_support.dart';

void main() {
  // The splash route is the brand opening's last frame (the word), on charcoal in both themes.
  nightGolden('splash', () => const SplashScreen());
  // The brand opening, frozen: the "mo" of the system splash, the ring eye inking, "mock"
  // unfolding, and the word.
  nightGolden('opening_mo', () => ColdOpen(onDone: () {}, progress: 0));
  nightGolden('opening_ink', () => ColdOpen(onDone: () {}, progress: 0.42));
  nightGolden('opening_unfold', () => ColdOpen(onDone: () {}, progress: 0.62));
  nightGolden('cold_open_draw', () => ColdOpen(onDone: () {}, progress: 0.75));
  nightGolden('cold_open_end', () => ColdOpen(onDone: () {}, progress: 1));
}
