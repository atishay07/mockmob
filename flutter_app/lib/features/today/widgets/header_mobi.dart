// Mobi in Today's header, every day (owner feedback 13 Oct: "animated everywhere, like Duo"). A
// 56 dp living Mobi beside the greeting: he breathes and blinks, cheers only when today's opened
// result improved or held, waves for any other submission, yawns after 11 PM, points at the move
// card when one is ready (aimed at the card itself, again after layout and scroll), and says one
// short line when tapped. When the hero already has Mobi (day one, coming back, late night) the
// header leaves him out, so there is never a second Mobi on the screen.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';

class HeaderMobi extends StatefulWidget {
  const HeaderMobi({super.key, required this.cue, this.aim});

  final HeaderMobiCue cue;

  /// The move card's key: where Mobi points when the cue is [HeaderMobiKind.point].
  final GlobalKey? aim;

  static const double size = 56;

  @override
  State<HeaderMobi> createState() => _HeaderMobiState();
}

class _HeaderMobiState extends State<HeaderMobi> with WidgetsBindingObserver {
  final MobiController _mobi = MobiController();
  Timer? _hush;
  int _tap = 0;
  ScrollPosition? _position;
  Offset? _aimedVector;
  bool _aimQueued = false;

  MobiAct get _entrance => switch (widget.cue.kind) {
        HeaderMobiKind.cheer => MobiAct.cheer,
        HeaderMobiKind.sleepy => MobiAct.sleepy,
        HeaderMobiKind.point => MobiAct.point,
        HeaderMobiKind.idle => MobiAct.hello,
      };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _reaim();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The page scrolls under him: keep the aim on the card as it moves.
    final position = Scrollable.maybeOf(context)?.position;
    if (position == _position) return;
    _position?.removeListener(_reaim);
    _position = position?..addListener(_reaim);
  }

  @override
  void didUpdateWidget(HeaderMobi old) {
    super.didUpdateWidget(old);
    if (old.cue.kind != widget.cue.kind) {
      _mobi.play(_entrance);
      _aimedVector = null;
    }
    _reaim();
  }

  /// Text scale, rotation and window changes move the card.
  @override
  void didChangeMetrics() => _reaim();

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _position?.removeListener(_reaim);
    _hush?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  /// Aims once per frame, after layout, and only when the card moved relative to Mobi.
  void _reaim() {
    if (_aimQueued || widget.cue.kind != HeaderMobiKind.point || widget.aim == null) return;
    _aimQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _aimQueued = false;
      if (mounted) _aim();
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  void _aim() {
    final key = widget.aim;
    final card = key?.currentContext?.findRenderObject();
    final me = context.findRenderObject();
    if (key == null || card is! RenderBox || me is! RenderBox || !card.attached || !card.hasSize || !me.hasSize) return;
    final vector = card.localToGlobal(card.size.center(Offset.zero)) - me.localToGlobal(Offset.zero);
    final last = _aimedVector;
    if (last != null && (vector - last).distance < 1.5) return;
    _aimedVector = vector;
    _mobi.pointAtWidget(key);
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
