import 'package:flutter/material.dart';
import 'package:mockmob/core/mascot/mascot.dart';

import '../core/night_support.dart';
import 'mascot_support.dart';

void main() {
  mobiSheetGolden(
    'mobi_states',
    'Mobi, every state',
    size: 136,
    [
        ('idle', MobiMoves.keyPose(MobiAct.idle)),
        ('hello', MobiMoves.keyPose(MobiAct.hello)),
        ('talk', MobiMoves.keyPose(MobiAct.talk)),
        ('cheer', MobiMoves.keyPose(MobiAct.cheer)),
        ('celebrate', MobiMoves.keyPose(MobiAct.celebrate)),
        ('think', MobiMoves.keyPose(MobiAct.think)),
        ('point', MobiMoves.keyPose(MobiAct.point)),
        ('look at', const MobiRig(lookX: -0.9, lookY: -0.8, tilt: -0.03)),
        ('sleepy', MobiMoves.keyPose(MobiAct.sleepy).copyWith(zzz: 0.45)),
        ('oops', MobiMoves.keyPose(MobiAct.oops)),
        ('rest', MobiMoves.keyPose(MobiAct.rest)),
        ('read', MobiMoves.keyPose(MobiAct.read)),
    ],
  );

  nightGolden(
    'mobi_sizes',
    () => const Padding(
      padding: EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          _Still(40),
          SizedBox(width: 12),
          _Still(64),
          SizedBox(width: 12),
          _Still(120),
        ]),
        SizedBox(height: 16),
        _Still(240),
      ]),
    ),
  );
}

class _Still extends StatelessWidget {
  const _Still(this.size);
  final double size;

  @override
  Widget build(BuildContext context) => MobiFigure.still(MobiMoves.keyPose(MobiAct.hello), size: size);
}
