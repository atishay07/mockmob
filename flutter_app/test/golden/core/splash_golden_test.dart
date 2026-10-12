import 'package:mockmob/core/router/splash_screen.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import 'night_support.dart';

void main() {
  nightGolden('splash', () => const SplashScreen());
  nightGolden('cold_open_draw', () => ColdOpen(onDone: () {}, progress: 0.4));
  nightGolden('cold_open_end', () => ColdOpen(onDone: () {}, progress: 1));
}
