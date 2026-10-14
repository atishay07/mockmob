import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/widgets/late_night_line.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../widgets/result_space.dart';
import 'recap_mobi.dart';
import 'recap_room.dart';

/// What the recap says when the student chooses "Finish for now": Mobi appears and plays the act
/// the reaction table gives this result (proud, cheer, an encouraging nod, a rest, or sleepy with
/// "Goodnight" late at night), the one plain line says what is in the record, and then Today
/// takes over.
///
/// It leaves when the act has ended plus 900 ms (never on a blind timer), at a tap at once, or
/// from the quiet "Continue to Today" key that appears at 1.2 s. It leaves by fading through the
/// ground, so there is no cut. On an NTA result there is no Mobi, only the line (the exam stays
/// exam-faithful); under reduced motion Mobi holds its pose and the screen waits the plain 2.2
/// seconds.
class RecapFinish extends StatefulWidget {
  const RecapFinish({super.key, required this.model, required this.reaction, required this.onDone});

  final RecapModel model;

  /// From [recapReaction]; null on an NTA result.
  final RecapReaction? reaction;

  /// Today takes over. Called once, after the fade.
  final VoidCallback onDone;

  /// When the quiet key appears.
  static const Duration keyAfter = Duration(milliseconds: 1200);

  @override
  State<RecapFinish> createState() => _RecapFinishState();
}

class _RecapFinishState extends State<RecapFinish> {
  Timer? _hold;
  Timer? _fade;
  bool _keyShown = false;
  bool _leaving = false;
  Timer? _keyTimer;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduced = Motion.reduced(context);
    _hold = Timer(recapFinishHold(widget.reaction, reduced: reduced), _leave);
    _keyTimer = Timer(RecapFinish.keyAfter, () {
      if (mounted) setState(() => _keyShown = true);
    });
  }

  @override
  void dispose() {
    _hold?.cancel();
    _fade?.cancel();
    _keyTimer?.cancel();
    super.dispose();
  }

  void _leave() {
    if (_leaving || !mounted) return;
    _leaving = true;
    _hold?.cancel();
    setState(() {});
    // Fade through the ground, then hand over.
    _fade = Timer(Motion.of(context, Motion.card), () {
      if (mounted) widget.onDone();
    });
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    final pose = RecapMobi.poseOf(widget.reaction);
    final line = widget.reaction?.line == RecapLineId.goodnight ? ResultCopy.goodnight : null;
    final fade = Motion.of(context, Motion.card);
    return RecapRoom(
      subjectId: m.subjectId,
      child: SafeArea(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _leave,
          child: AnimatedOpacity(
            opacity: _leaving ? 0 : 1,
            duration: fade,
            curve: Motion.exit,
            child: Stack(
              children: [
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(ResultSpace.moment),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (pose != null) ...[
                          RecapMobi(pose: pose, size: 96, line: line),
                          const SizedBox(height: MmSpace.s24),
                        ],
                        Semantics(liveRegion: true, child: ReceiptLine(text: ResultCopy.finishLine(m.mockLabel, m.candidates.length))),
                        const LateNightLine(),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: ResultSpace.moment,
                  right: ResultSpace.moment,
                  bottom: MmSpace.s16,
                  child: ExcludeSemantics(
                    excluding: !_keyShown,
                    child: IgnorePointer(
                      ignoring: !_keyShown,
                      child: AnimatedOpacity(
                        opacity: _keyShown ? 1 : 0,
                        duration: Motion.of(context, Motion.ui),
                        curve: Motion.glide,
                        child: Center(child: KeyButton.quiet(label: ResultCopy.continueToToday, onPressed: _leave)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
