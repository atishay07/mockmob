import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import '../controls/chip.dart';
import '../mobi.dart';

/// Mobi in the lab: a live stage with every act, a line to say, a target to point at and a pad
/// the eyes follow; then the pose-based Mobi as screens use it.
class LabMobi extends StatefulWidget {
  const LabMobi({super.key});

  @override
  State<LabMobi> createState() => _LabMobiState();
}

class _LabMobiState extends State<LabMobi> {
  final MobiController _mobi = MobiController();
  final GlobalKey _target = GlobalKey();
  MobiAct? _last;
  int _line = 0;

  static const List<String> _lines = [
    "Hi, I'm Mobi. Let's find where your marks go.",
    'Mock 7 done. That is your third full paper this month.',
    'Late one tonight. Ten minutes, then sleep.',
  ];

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  void _play(MobiAct act) {
    setState(() => _last = act);
    _mobi.play(act);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const poses = [MobiPose.greet, MobiPose.point, MobiPose.think, MobiPose.cheer, MobiPose.rest, MobiPose.sleepy, MobiPose.read];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(child: MobiStage(controller: _mobi, size: 170, semanticLabel: 'Mobi', bubbleWidth: 300)),
        const SizedBox(height: MmSpace.s12),
        Wrap(
          spacing: MmSpace.s8,
          runSpacing: MmSpace.s8,
          children: [
            for (final act in MobiAct.values)
              if (act != MobiAct.talk) MmChip(label: act.name, selected: _last == act, onTap: () => _play(act)),
            MmChip(
              label: 'say',
              selected: false,
              onTap: () => _mobi.say(_lines[_line++ % _lines.length]),
            ),
            MmChip(label: 'point at the dot', selected: false, onTap: () => _mobi.pointAtWidget(_target)),
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        GestureDetector(
          onPanDown: (d) => _mobi.lookAt(d.globalPosition),
          onPanUpdate: (d) => _mobi.lookAt(d.globalPosition),
          onPanEnd: (_) => _mobi.lookAt(null),
          onPanCancel: () => _mobi.lookAt(null),
          child: Container(
            height: 88,
            decoration: BoxDecoration(
              color: colors.sunken,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.line),
            ),
            child: Stack(
              children: [
                Center(child: Text('Drag here: Mobi watches', style: type.caption.copyWith(color: colors.ink3))),
                Positioned(
                  right: 18,
                  top: 18,
                  child: Container(key: _target, width: 14, height: 14, decoration: BoxDecoration(color: colors.volt, shape: BoxShape.circle)),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s20),
        Wrap(spacing: 4, runSpacing: 8, children: [for (final p in poses) Mobi(pose: p, size: 72)]),
        const SizedBox(height: 12),
        const Mobi(pose: MobiPose.sleepy, size: 88, say: 'Late one tonight. Ten minutes, then sleep.'),
      ],
    );
  }
}
