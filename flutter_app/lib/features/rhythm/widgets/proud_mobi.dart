// Mobi at a milestone: the proud act (stretches tall, mittens on hips, chin up, three glints),
// not the hop. Used only where something the server has already dated has landed: a week met, a
// step landed, every step landed. He acts after the state lands, never before it: with [delay] he
// is not on stage until the number or the coin has settled, and his place is kept so nothing
// moves when he arrives. He plays once on arriving and holds his pose; under reduced motion he is
// the still key pose at once. [say] is one short line in a bubble beside Mobi.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

class ProudMobi extends StatefulWidget {
  const ProudMobi({super.key, this.size = 72, this.say, this.delay = Duration.zero});

  /// Height in dp.
  final double size;
  final String? say;

  /// How long to wait before Mobi appears and acts: the time the thing he celebrates takes to land.
  final Duration delay;

  @override
  State<ProudMobi> createState() => _ProudMobiState();
}

class _ProudMobiState extends State<ProudMobi> {
  final MobiController _controller = MobiController();
  Timer? _wait;
  bool _ready = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (widget.delay <= Duration.zero || Motion.reduced(context)) {
      _arrive();
    } else {
      _wait = Timer(widget.delay, () {
        if (mounted) setState(_arrive);
      });
    }
  }

  void _arrive() {
    _ready = true;
    final line = widget.say;
    if (line != null) _controller.say(line);
  }

  @override
  void didUpdateWidget(ProudMobi old) {
    super.didUpdateWidget(old);
    final line = widget.say;
    if (_ready && line != null && line != old.say) _controller.say(line);
  }

  @override
  void dispose() {
    _wait?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Widget body = _ready
        ? MobiCharacter(
            controller: _controller,
            size: widget.size,
            entrance: MobiAct.proud,
            lite: widget.size < 72,
            watchTaps: false,
          )
        // His place, kept empty: the same box he will stand in, so his arrival moves nothing.
        : SizedBox(width: MobiFigure.widthFor(widget.size), height: widget.size);
    if (widget.say == null) return body;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        body,
        const SizedBox(width: MmSpace.s4),
        Flexible(
          child: ValueListenableBuilder<MobiSpeech?>(
            valueListenable: _controller.speech,
            builder: (context, speech, _) => speech == null
                ? const SizedBox.shrink()
                : MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.left, maxWidth: 250),
          ),
        ),
      ],
    );
  }
}
