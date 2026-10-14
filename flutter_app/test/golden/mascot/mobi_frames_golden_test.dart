import 'package:mockmob/core/mascot/mascot.dart';

import '../core/night_support.dart';
import 'mascot_support.dart';

void main() {
  nightGolden('mobi_frames_wave', () => MobiSheet(title: 'Hello wave', frames: framesOf(MobiAct.hello, const [0.1, 0.25, 0.45, 0.65, 0.85, 1.05, 1.3, 1.55, 1.8])));
  nightGolden('mobi_frames_cheer', () => MobiSheet(title: 'Cheer', frames: framesOf(MobiAct.cheer, const [0.08, 0.16, 0.3, 0.42, 0.56, 0.68, 0.8, 0.95, 1.2])));
  nightGolden('mobi_frames_talk', () => MobiSheet(title: 'Talk', frames: framesOf(MobiAct.talk, const [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0, 1.2, 1.5], seconds: 1.6)));
  nightGolden('mobi_frames_celebrate', () => MobiSheet(title: 'Celebrate', frames: framesOf(MobiAct.celebrate, const [0.12, 0.3, 0.45, 0.6, 0.75, 0.9, 1.1, 1.35, 1.7])));
  nightGolden('mobi_frames_oops_sleepy', () => MobiSheet(title: 'Oops, then sleepy', frames: [
        ...framesOf(MobiAct.oops, const [0.15, 0.45, 0.9]),
        ...framesOf(MobiAct.sleepy, const [0.4, 1.0, 3.6]),
        ...framesOf(MobiAct.rest, const [0.2, 0.45, 1.2]),
      ]));
}
