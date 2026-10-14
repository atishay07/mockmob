import 'package:mockmob/core/mascot/mascot.dart';

import 'mascot_support.dart';

void main() {
  mobiSheetGolden('mobi_frames_wave', 'Hello wave', framesOf(MobiAct.hello, const [0.1, 0.25, 0.45, 0.65, 0.85, 1.05, 1.3, 1.55, 1.8]));
  mobiSheetGolden('mobi_frames_cheer', 'Cheer', framesOf(MobiAct.cheer, const [0.08, 0.16, 0.3, 0.42, 0.56, 0.68, 0.8, 0.95, 1.2]));
  mobiSheetGolden('mobi_frames_talk', 'Talk', framesOf(MobiAct.talk, const [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0, 1.2, 1.5], seconds: 1.6));
  mobiSheetGolden('mobi_frames_celebrate', 'Celebrate', framesOf(MobiAct.celebrate, const [0.12, 0.3, 0.45, 0.6, 0.75, 0.9, 1.1, 1.35, 1.7]));
  mobiSheetGolden('mobi_frames_oops_sleepy', 'Oops, then sleepy', [
    ...framesOf(MobiAct.oops, const [0.15, 0.45, 0.9], name: 'oops'),
    ...framesOf(MobiAct.sleepy, const [0.4, 1.0, 3.6], name: 'sleepy'),
    ...framesOf(MobiAct.rest, const [0.2, 0.45, 1.2], name: 'rest'),
  ]);
}
