import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The band between the question region and the bottom bar: "Clear my answer" while there is an
/// answer, and for 4 s after clearing, "Answer cleared." with an Undo key in the same place, which
/// puts the answer back through the same path as choosing it. It is pinned outside the scrolling
/// question, so the key is never cut by the bar or hidden under the fade at the foot of a long
/// question (finding 11), and its height never changes ([height], so nothing jumps).
class ClearBand extends StatefulWidget {
  const ClearBand({super.key, required this.selected, required this.canAnswer, required this.onSelect});

  final int? selected;
  final bool canAnswer;
  final ValueChanged<int?> onSelect;

  /// The band's height: the key's 48 dp and 4 dp of air above and below it. Reserved whether or not the key
  /// shows, so the question region never changes height under the student's finger.
  static const double height = MmTarget.min + MmSpace.s8;

  /// How long the Undo stays.
  static const Duration undoHold = Duration(seconds: 4);

  @override
  State<ClearBand> createState() => ClearBandState();
}

class ClearBandState extends State<ClearBand> {
  int? _cleared;
  Timer? _timer;

  @override
  void didUpdateWidget(ClearBand oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A new answer (or answering closing) ends the chance to undo.
    if (_cleared != null && (widget.selected != null || !widget.canAnswer)) _drop();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _drop() {
    _timer?.cancel();
    _timer = null;
    _cleared = null;
  }

  void _clear() {
    final was = widget.selected;
    if (was == null) return;
    _timer?.cancel();
    setState(() => _cleared = was);
    _timer = Timer(ClearBand.undoHold, () {
      if (mounted) setState(_drop);
    });
    widget.onSelect(null);
  }

  void _undo() {
    final back = _cleared;
    if (back == null) return;
    setState(_drop);
    widget.onSelect(back);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final Widget content;
    if (widget.selected != null && widget.canAnswer) {
      content = KeyButton.secondary(
        key: const ValueKey('clear'),
        label: RunnerCopy.clearAnswer,
        onPressed: _clear,
        expanded: false,
        minHeight: MmTarget.min,
        hapticOnCommit: false,
      );
    } else if (_cleared != null && widget.canAnswer) {
      content = Row(
        key: const ValueKey('undo'),
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            liveRegion: true,
            child: Text(RunnerCopy.answerCleared, style: type.body.copyWith(color: colors.ink2)),
          ),
          const SizedBox(width: MmSpace.s12),
          KeyButton.secondary(label: RunnerCopy.undo, onPressed: _undo, expanded: false, minHeight: MmTarget.min, hapticOnCommit: false),
        ],
      );
    } else {
      content = const SizedBox.shrink(key: ValueKey('none'));
    }
    // Chrome, like the bar below it: the key's words grow with the system text size up to 1.3x
    // and the band grows with them (never a fixed box a large key would overflow).
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: ClearBand.height),
        child: Align(
          alignment: Alignment.centerLeft,
          child: AnimatedSwitcher(
            duration: Motion.of(context, Motion.ui),
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
            child: content,
          ),
        ),
      ),
    );
  }
}
