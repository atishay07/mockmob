// Mobi at a milestone: the proud act (stretches tall, mittens on hips, chin up, three glints),
// not the hop. Used only where something the server has already dated has landed: a week met, a
// step landed, every step landed. It plays once on arriving and holds its pose; under reduced
// motion it is the still key pose. [say] is one short line in a bubble beside Mobi.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

class ProudMobi extends StatefulWidget {
  const ProudMobi({super.key, this.size = 72, this.say});

  /// Height in dp.
  final double size;
  final String? say;

  @override
  State<ProudMobi> createState() => _ProudMobiState();
}

class _ProudMobiState extends State<ProudMobi> {
  final MobiController _controller = MobiController();

  @override
  void initState() {
    super.initState();
    final line = widget.say;
    if (line != null) _controller.say(line);
  }

  @override
  void didUpdateWidget(ProudMobi old) {
    super.didUpdateWidget(old);
    final line = widget.say;
    if (line != null && line != old.say) _controller.say(line);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final body = MobiCharacter(
      controller: _controller,
      size: widget.size,
      entrance: MobiAct.proud,
      lite: widget.size < 72,
      watchTaps: false,
    );
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
