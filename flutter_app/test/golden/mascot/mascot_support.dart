import 'package:flutter/material.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/theme/theme.dart';

/// A labelled grid of Mobi frames for goldens.
class MobiSheet extends StatelessWidget {
  const MobiSheet({super.key, required this.title, required this.frames, this.size = 132, this.columns = 3});

  final String title;
  final List<(String, MobiRig)> frames;
  final double size;
  final int columns;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 20, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: type.title),
          const SizedBox(height: 12),
          Wrap(
            runSpacing: 10,
            children: [
              for (final (label, rig) in frames)
                SizedBox(
                  width: (384 - 24) / columns,
                  child: Column(children: [
                    MobiFigure.still(rig, size: size),
                    const SizedBox(height: 4),
                    Text(label, style: type.caption.copyWith(color: colors.ink2)),
                  ]),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Frames of [act] at [times] (seconds), stepped exactly as a 60 fps screen would.
List<(String, MobiRig)> framesOf(MobiAct act, List<double> times, {void Function(MobiSim)? setup, double? seconds}) {
  final sim = MobiSim();
  setup?.call(sim);
  sim.run(0.5);
  sim.play(act, seconds: seconds);
  var at = 0.0;
  return [
    for (final t in times) ('${(t * 1000).round()} ms', sim.run(t - at, fps: 60).copyWith()).also(() => at = t),
  ];
}

extension<T> on T {
  T also(void Function() f) {
    f();
    return this;
  }
}
