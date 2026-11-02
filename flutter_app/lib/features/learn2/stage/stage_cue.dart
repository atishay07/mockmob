/// The first feed's cue (the web's `.st-cue`; R2 ruling 7, LK29, R3-SPEC L3): a 36 dp chip centred in the 40 dp peek strip with
/// Mobi's head, "Swipe up for the next one" and an up chevron, so a student who has never used a story-like feed sees that it
/// moves by swiping. It fades in over 220 ms after 300 ms, bobs 3 times (420 ms up 6 dp, 380 ms back, ease-out) after 700 ms,
/// and leaves over 160 ms on the first move (nothing else moves when it goes). Reduced motion: still. It takes no touches.
///
/// The screen decides when it shows: on the first feed of a student, while a next item peeks, until the student moves once;
/// only then is the cue marked seen, never when it is shown.
library;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/mascot/mascot.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import 'stage_keys.dart' show stageSelect;
import 'stage_motion.dart';

class StageCue extends StatefulWidget {
  const StageCue({super.key, this.label = 'Swipe up for the next one', this.leaving = false});

  final String label;

  /// The student moved: the chip fades out over 160 ms.
  final bool leaving;

  /// The chip's height.
  static const double height = 36;

  @override
  State<StageCue> createState() => _StageCueState();
}

class _StageCueState extends State<StageCue> with SingleTickerProviderStateMixin {
  /// 700 ms of waiting, then three bobs of 800 ms.
  static const int _wait = 700;
  static const int _bob = 800;
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: _wait + _bob * 3));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// `st-bob`: up 6 dp over the first 52.5% of a bob, back over the rest, each leg ease-out.
  double _lift() {
    final ms = _c.value * (_wait + _bob * 3) - _wait;
    if (ms <= 0 || ms >= _bob * 3) return 0;
    final p = (ms % _bob) / _bob;
    final up = p < 0.525 ? Motion.out.transform(p / 0.525) : 1 - Motion.out.transform((p - 0.525) / 0.475);
    return -6 * up;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chip = Container(
      height: StageCue.height,
      padding: const EdgeInsets.fromLTRB(6, 0, 14, 0),
      decoration: BoxDecoration(
        color: colors.raised2,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.lineStrong),
        boxShadow: colors.cardShadow,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(
            child: DecoratedBox(
              decoration: BoxDecoration(shape: BoxShape.circle, color: stageSelect(colors).withValues(alpha: 0.16)),
              child: ClipOval(child: SizedBox.square(dimension: 28, child: MobiFace(size: 28, still: true, watchTaps: false))),
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          Text(widget.label, maxLines: 1, softWrap: false, style: type.label.copyWith(fontSize: 14, height: 1, fontWeight: FontWeight.w600, color: colors.ink)),
          const SizedBox(width: MmSpace.s8),
          Icon(LucideIcons.chevronUp, size: 16, color: colors.accentText),
        ],
      ),
    );
    return Semantics(
      container: true,
      label: widget.label,
      excludeSemantics: true,
      child: AnimatedOpacity(
        opacity: widget.leaving ? 0 : 1,
        duration: Motion.of(context, const Duration(milliseconds: 160)),
        curve: Motion.out,
        child: StageIn(
          delay: const Duration(milliseconds: 300),
          duration: const Duration(milliseconds: 220),
          child: AnimatedBuilder(
            animation: _c,
            child: chip,
            builder: (context, child) => Transform.translate(offset: Offset(0, _lift()), child: child),
          ),
        ),
      ),
    );
  }
}
