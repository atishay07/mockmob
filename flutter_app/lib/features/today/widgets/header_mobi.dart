// Mobi in Today's header, every day (owner feedback 13 Oct: "animated everywhere, like Duo"). A
// 56 dp living Mobi beside the greeting: he breathes and blinks, cheers once when a set was
// recorded today, yawns after 11 PM, points down at the move when one is ready, and says one
// short line when tapped. When the hero already has Mobi (day one, coming back, late night) the
// header leaves him out, so there is never a second Mobi on the screen.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';

class HeaderMobi extends StatefulWidget {
  const HeaderMobi({super.key, required this.cue});

  final HeaderMobiCue cue;

  static const double size = 56;

  @override
  State<HeaderMobi> createState() => _HeaderMobiState();
}

class _HeaderMobiState extends State<HeaderMobi> {
  final MobiController _mobi = MobiController();
  Timer? _hush;
  int _tap = 0;

  MobiAct get _entrance => switch (widget.cue.kind) {
        HeaderMobiKind.cheer => MobiAct.cheer,
        HeaderMobiKind.sleepy => MobiAct.sleepy,
        HeaderMobiKind.point => MobiAct.point,
        HeaderMobiKind.idle => MobiAct.hello,
      };

  @override
  void initState() {
    super.initState();
    // Pointing is aimed down at the move card, once the header is laid out.
    if (widget.cue.kind == HeaderMobiKind.point) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final box = context.findRenderObject();
        if (box is RenderBox && box.hasSize) _mobi.pointAt(box.localToGlobal(Offset(-40, box.size.height + 140)));
      });
    }
  }

  @override
  void didUpdateWidget(HeaderMobi old) {
    super.didUpdateWidget(old);
    if (old.cue.kind != widget.cue.kind) _mobi.play(_entrance);
  }

  @override
  void dispose() {
    _hush?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  void _onTap() {
    final lines = widget.cue.lines;
    if (lines.isEmpty) return;
    final line = lines[_tap++ % lines.length];
    _mobi.say(line, live: true);
    _hush?.cancel();
    _hush = Timer(Duration(milliseconds: (MobiTyping.duration(line) * 1000).round() + 3200), () {
      if (mounted) _mobi.hush();
    });
  }

  @override
  Widget build(BuildContext context) {
    final width = MobiFigure.widthFor(HeaderMobi.size);
    return Semantics(
      button: true,
      label: 'Mobi. Tap for a word.',
      onTap: _onTap,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _onTap,
        child: SizedBox(
          width: width + 8,
          height: HeaderMobi.size,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                right: 0,
                bottom: 0,
                child: MobiCharacter(controller: _mobi, size: HeaderMobi.size, entrance: _entrance, seed: 23),
              ),
              // The line floats to the left of Mobi, over the greeting, and goes after a moment.
              Positioned(
                right: width + 4,
                top: -2,
                child: ValueListenableBuilder<MobiSpeech?>(
                  valueListenable: _mobi.speech,
                  builder: (context, speech, _) => speech == null
                      ? const SizedBox.shrink()
                      : MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.right, maxWidth: 236),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
