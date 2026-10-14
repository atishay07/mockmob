import 'package:flutter/material.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../core/night_support.dart';
import 'mascot_support.dart';

/// The contact sheets for the acts added in the UI blitz (14 Oct 2026): key poses, the motion
/// of each new act frame by frame, the expressions, and the head-only face at list sizes.
void main() {
  nightGolden(
    'mobi_new_acts',
    () => MobiSheet(
      title: 'Mobi, the moments',
      size: 136,
      frames: [
        ('correct', MobiMoves.keyPose(MobiAct.correct)),
        ('encourage', MobiMoves.keyPose(MobiAct.encourage)),
        ('proud', MobiMoves.keyPose(MobiAct.proud)),
        ('loading', MobiMoves.keyPose(MobiAct.loading)),
        ('listen', MobiMoves.keyPose(MobiAct.listen)),
        ('nudge', MobiMoves.keyPose(MobiAct.nudge)),
        ('sleep', MobiMoves.keyPose(MobiAct.sleep)),
        ('wake', MobiMoves.keyPose(MobiAct.wake)),
        ('hello', MobiMoves.keyPose(MobiAct.hello)),
      ],
    ),
  );

  nightGolden(
    'mobi_close_ups',
    () => MobiSheet(
      title: 'Close up',
      size: 172,
      columns: 2,
      frames: [
        ('correct', MobiMoves.keyPose(MobiAct.correct)),
        ('encourage', MobiMoves.keyPose(MobiAct.encourage)),
        ('proud', MobiMoves.keyPose(MobiAct.proud)),
        ('listen', MobiMoves.keyPose(MobiAct.listen)),
        ('loading', MobiMoves.keyPose(MobiAct.loading)),
        ('sleep', MobiMoves.keyPose(MobiAct.sleep)),
      ],
    ),
  );

  nightGolden('mobi_frames_correct', () => MobiSheet(title: 'Correct', frames: framesOf(MobiAct.correct, const [0.06, 0.2, 0.3, 0.45, 0.55, 0.7, 0.85, 1.0, 1.15])));
  nightGolden('mobi_frames_encourage', () => MobiSheet(title: 'Encourage', frames: framesOf(MobiAct.encourage, const [0.12, 0.3, 0.45, 0.6, 0.7, 0.82, 0.95, 1.1, 1.45])));
  nightGolden('mobi_frames_proud', () => MobiSheet(title: 'Proud', frames: framesOf(MobiAct.proud, const [0.1, 0.3, 0.5, 0.7, 0.9, 1.15, 1.4, 1.75, 2.2])));
  nightGolden('mobi_frames_nudge_loading', () => MobiSheet(title: 'Nudge, then loading', frames: [
        ...framesOf(MobiAct.nudge, const [0.2, 0.46, 0.7]),
        ...framesOf(MobiAct.loading, const [0.5, 1.0, 1.4]),
        ...framesOf(MobiAct.sleep, const [0.4, 1.2, 3.0]),
      ]));
  nightGolden(
    'mobi_frames_fidgets',
    () => MobiSheet(title: 'Idle fidgets', frames: [
      for (final (kind, name) in const [(0, 'smile'), (1, 'shift'), (2, 'flick')])
        for (final t in const [0.15, 0.5, 0.8]) ('$name ${(t * 1000).round()} ms', MobiMoves.fidget(kind, t, const MobiRig())),
    ]),
  );
  nightGolden(
    'mobi_frames_wake',
    () => MobiSheet(
      title: 'Asleep, then a tap',
      frames: framesOf(MobiAct.wake, const [0.0, 0.06, 0.16, 0.3, 0.42, 0.6, 0.85, 1.04, 1.2], setup: (sim) => sim
        ..play(MobiAct.sleep)
        ..run(3)),
    ),
  );
  nightGolden('mobi_frames_hello_appear', () => MobiSheet(title: 'Appear, then hello', frames: [
        ...framesOf(MobiAct.appear, const [0.08, 0.2, 0.32, 0.5, 0.75]),
        ...framesOf(MobiAct.hello, const [0.1, 0.4, 1.5, 1.66]),
      ]));

  nightGolden(
    'mobi_expressions',
    () => MobiSheet(
      title: 'Eyes',
      size: 120,
      frames: const [
        ('open', MobiRig()),
        ('smile', MobiRig(eyeL: MobiEye(smile: 0.6), eyeR: MobiEye(smile: 0.6))),
        ('happy', MobiRig(eyeL: MobiEye(happy: 1), eyeR: MobiEye(happy: 1))),
        ('content', MobiRig(eyeL: MobiEye(smile: 0.72, lid: 0.14), eyeR: MobiEye(smile: 0.72, lid: 0.14), lookY: -0.5)),
        ('wide', MobiRig(eyeL: MobiEye(open: 1.12), eyeR: MobiEye(open: 1.12))),
        ('focus', MobiRig(eyeL: MobiEye(lid: 0.18), eyeR: MobiEye(lid: 0.18), lookY: -0.45, glow: 0.8)),
      ],
    ),
  );

  nightGolden(
    'mobi_faces',
    () => Builder(builder: (context) {
      final type = context.mmType;
      Widget row(String label, List<Widget> items) => Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: type.caption.copyWith(color: context.mmColors.ink2)),
              const SizedBox(height: 8),
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                for (final w in items) Padding(padding: const EdgeInsets.only(right: 14), child: w),
              ]),
            ]),
          );
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Mobi in rows', style: type.title),
          const SizedBox(height: 16),
          row('Face, 24 to 56 dp', [
            for (final s in const [24.0, 32.0, 40.0, 56.0]) MobiFigure.still(const MobiRig(), size: s, head: true, lite: true),
          ]),
          row('Face moods at 40 dp', [
            MobiFigure.still(MobiMoves.keyPose(MobiAct.correct).copyWith(bubble: -1), size: 40, head: true, lite: true),
            MobiFigure.still(MobiMoves.keyPose(MobiAct.encourage), size: 40, head: true, lite: true),
            MobiFigure.still(MobiMoves.keyPose(MobiAct.loading), size: 40, head: true, lite: true),
            MobiFigure.still(MobiMoves.keyPose(MobiAct.listen), size: 40, head: true, lite: true),
            MobiFigure.still(MobiMoves.keyPose(MobiAct.sleep).copyWith(y: 0, zzz: -1), size: 40, head: true, lite: true),
          ]),
          row('Lite body at 48 and 64 dp', [
            MobiFigure.still(MobiMoves.keyPose(MobiAct.hello), size: 48, lite: true),
            MobiFigure.still(MobiMoves.keyPose(MobiAct.point), size: 64, lite: true),
            MobiFigure.still(MobiMoves.keyPose(MobiAct.correct), size: 64, lite: true),
          ]),
          row('A thread line', [
            Row(children: [
              MobiFigure.still(MobiMoves.keyPose(MobiAct.listen), size: 36, head: true, lite: true),
              const SizedBox(width: 10),
              Text('Where am I losing marks?', style: type.body),
            ]),
          ]),
        ]),
      );
    }),
  );
}
