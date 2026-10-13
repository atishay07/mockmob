// Mobi at a human moment on Today (day one, coming back after days away, late at night): the
// living character on the left, its one line typed into a bubble beside it, and the move's
// overline and subject under the bubble, so the card stays compact. Mobi plays its pose's act
// when it appears (a wave, a yawn) and again whenever the screen asks through [controller].
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

class MobiMoment extends StatefulWidget {
  const MobiMoment({super.key, required this.pose, required this.lines, this.say, this.controller, this.size = 92});

  final MobiPose pose;

  /// The overline and subject, set under the bubble.
  final Widget lines;
  final String? say;
  final MobiController? controller;
  final double size;

  @override
  State<MobiMoment> createState() => _MobiMomentState();
}

class _MobiMomentState extends State<MobiMoment> {
  MobiController? _own;
  MobiController get _controller => widget.controller ?? (_own ??= MobiController());

  @override
  void initState() {
    super.initState();
    final line = widget.say;
    if (line != null) _controller.say(line);
  }

  @override
  void didUpdateWidget(MobiMoment old) {
    super.didUpdateWidget(old);
    final line = widget.say;
    if (line != null && line != old.say) _controller.say(line);
  }

  @override
  void dispose() {
    _own?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Transform.translate(
          offset: const Offset(-8, 0),
          child: MobiCharacter(
            controller: _controller,
            size: widget.size,
            entrance: widget.pose.act,
            interactive: true,
            seed: 7 + widget.pose.index * 13,
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ValueListenableBuilder<MobiSpeech?>(
                valueListenable: _controller.speech,
                builder: (context, speech, _) => speech == null
                    ? const SizedBox.shrink()
                    : MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.left, maxWidth: 230),
              ),
              const SizedBox(height: MmSpace.s12),
              widget.lines,
            ],
          ),
        ),
      ],
    );
  }
}
