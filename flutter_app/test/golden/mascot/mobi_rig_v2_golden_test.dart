import 'package:flutter/material.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../core/night_support.dart';
import 'mascot_support.dart';

/// Rig v2 (15 Oct 2026, the quality pass): one sheet of every act and every mood, the faces at
/// avatar sizes (every expression has to read at 32 dp), and the new acts frame by frame. Night
/// and Day.
void main() {
  mobiSheetGolden(
    'mobi_v2_every_act',
    'Every act',
    [for (final a in MobiAct.values) (a.name, MobiMoves.keyPose(a))],
    size: 104,
    columns: 4,
  );

  mobiSheetGolden(
    'mobi_v2_every_mood',
    'Every mood',
    [for (final m in MobiMood.values) (m.name, MobiMoods.apply(m, const MobiRig()))],
    size: 124,
    columns: 4,
  );

  nightGolden(
    'mobi_v2_faces_small',
    () => Builder(builder: (context) {
      final type = context.mmType;
      final faces = <(String, MobiRig)>[
        for (final m in MobiMood.values) (m.name, MobiMoods.apply(m, const MobiRig())),
        for (final a in [MobiAct.correct, MobiAct.encourage, MobiAct.sympathy, MobiAct.focus, MobiAct.idea, MobiAct.curious, MobiAct.think, MobiAct.oops, MobiAct.sleep])
          (a.name, MobiMoves.keyPose(a).copyWith(bubble: -1, zzz: -1, y: 0)),
      ];
      Widget grid(double size) => Wrap(
            spacing: 6,
            runSpacing: 8,
            children: [
              for (final (label, rig) in faces)
                SizedBox(
                  width: 54,
                  child: Column(children: [
                    MobiFigure.still(rig, size: size, head: true, lite: true),
                    const SizedBox(height: 2),
                    Text(label, style: type.caption.copyWith(fontSize: 10, color: context.mmColors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
            ],
          );
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Faces at 32 and 40 dp', style: type.title),
          const SizedBox(height: 12),
          Text('32 dp', style: type.caption.copyWith(color: context.mmColors.ink2)),
          const SizedBox(height: 6),
          grid(32),
          const SizedBox(height: 14),
          Text('40 dp', style: type.caption.copyWith(color: context.mmColors.ink2)),
          const SizedBox(height: 6),
          grid(40),
        ]),
      );
    }),
    size: const Size(384, 640),
  );

  mobiSheetGolden('mobi_v2_frames_hop_idea', 'Hop, then an idea', [
    ...framesOf(MobiAct.hop, const [0.08, 0.26, 0.4, 0.56, 0.72, 0.8], name: 'hop'),
    ...framesOf(MobiAct.idea, const [0.1, 0.3, 0.5, 0.7, 1.0, 1.35], name: 'idea'),
  ]);
  mobiSheetGolden('mobi_v2_frames_curious_focus', 'Curious, then focus', [
    ...framesOf(MobiAct.curious, const [0.14, 0.34, 0.6, 0.9, 1.2, 1.4], name: 'curious'),
    ...framesOf(MobiAct.focus, const [0.12, 0.3, 0.5, 0.7, 0.9, 1.1], name: 'focus'),
  ]);
  mobiSheetGolden('mobi_v2_frames_sympathy', 'Sympathy after a miss', framesOf(MobiAct.sympathy, const [0.1, 0.3, 0.5, 0.64, 0.84, 1.1, 1.3, 1.55, 1.8]));
}
