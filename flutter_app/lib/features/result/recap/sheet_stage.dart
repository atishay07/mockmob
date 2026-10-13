import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../sheet/flap_faces.dart';
import '../sheet/folded_sheet.dart';
import '../sheet/paper.dart';
import '../sheet/sheet_body.dart';
import '../sheet/sheet_geometry.dart';
import 'marks_footer.dart';
import 'sealed_parts.dart';

/// How the sheet arrives on card 1.
enum SheetEntry {
  /// Folded and sealed: the full swipe-up ritual (the first three sheets).
  sealed,

  /// Folded and sealed, but one tap fades it open (from the fourth sheet, spec 5.6.1).
  sealedDecayed,

  /// Already open (Replay recap): the bubbles ink and the figure lands again.
  open,

  /// Already open and settled (coming back from card 2): nothing moves.
  settled,
}

/// Card 1: the folded answer sheet, its unfolding, and the marks.
///
/// Drag the tab or the sheet upward: the flap follows the finger 1:1 over 180 dp with ticks at
/// 25, 50 and 75%; let go past 60% (or flick) and it completes with the open haptic, otherwise it
/// settles back. A tap lifts it on a script. "Open without the reveal" and a TalkBack action
/// always skip the ritual, so the result is never withheld.
class SheetStage extends ConsumerStatefulWidget {
  const SheetStage({
    super.key,
    required this.model,
    required this.entry,
    required this.firstEver,
    required this.onOpened,
    required this.onNext,
    required this.onFirstFix,
    required this.onWithoutReveal,
  });

  final RecapModel model;
  final SheetEntry entry;

  /// The student's first sealed sheet ever: the tab nudges once.
  final bool firstEver;
  final VoidCallback onOpened;
  final VoidCallback onNext;
  final VoidCallback onFirstFix;
  final VoidCallback onWithoutReveal;

  static const double dragDistance = 180;

  @override
  ConsumerState<SheetStage> createState() => _SheetStageState();
}

class _SheetStageState extends ConsumerState<SheetStage> with TickerProviderStateMixin {
  late final AnimationController _open;
  late final AnimationController _reveal;
  late final AnimationController _fade;
  late final Animation<double> _ink;
  late final Animation<double> _sweep;
  late final Animation<double> _footer;
  Timer? _nudgeTimer;
  bool _opened = false;
  bool _figureIn = false;
  bool _mobiIn = false;
  bool _calm = false;
  bool _crossFading = false;
  double _dragStart = 0;
  double _dragDy = 0;

  /// True while the drag that is under way started on the folded sheet. The same drag can lay
  /// the flap flat; it must not also turn to card 2 and skip the reveal.
  bool _dragFromSealed = false;
  int _ticks = 0;

  RecapVariant get _variant => widget.model.variant;
  bool get _sealed => widget.entry == SheetEntry.sealed || widget.entry == SheetEntry.sealedDecayed;

  @override
  void initState() {
    super.initState();
    _open = AnimationController(vsync: this, value: _sealed ? 0 : 1);
    _reveal = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500));
    _fade = AnimationController(vsync: this, duration: const Duration(milliseconds: 160));
    _ink = CurvedAnimation(parent: _reveal, curve: const Interval(0.02, 0.62));
    _sweep = CurvedAnimation(parent: _reveal, curve: const Interval(0.06, 0.53));
    _footer = CurvedAnimation(
      parent: _reveal,
      curve: const Interval(0.55, 0.85, curve: Motion.glide),
    );
    _reveal.addListener(_onReveal);
    _open.addStatusListener((s) {
      // A forward animation ends as "completed" wherever it stops (the nudge stops at 7%), so
      // only a flap that is really flat counts as open.
      if (s == AnimationStatus.completed && !_opened && _open.value >= 0.999) _didOpen();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _calm = Motion.reduced(context) || !_variant.celebratory || widget.entry == SheetEntry.settled;
    if (widget.entry == SheetEntry.settled && !_opened) {
      _opened = true;
      _figureIn = true;
      _mobiIn = true;
      _reveal.value = 1;
    }
    if (!_sealed && !_opened) {
      _opened = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _startReveal());
    }
    if (_sealed && widget.firstEver && _nudgeTimer == null && !Motion.reduced(context)) {
      _nudgeTimer = Timer(const Duration(milliseconds: 1200), _nudge);
    }
  }

  @override
  void dispose() {
    _nudgeTimer?.cancel();
    _open.dispose();
    _reveal.dispose();
    _fade.dispose();
    super.dispose();
  }

  Haptics get _haptics => ref.read(hapticsProvider);

  /// Once, on the very first sheet: the tab and the flap lift 12 dp and settle.
  Future<void> _nudge() async {
    if (!mounted || _opened || _open.isAnimating || _dragDy != 0) return;
    const lift = 12 / SheetStage.dragDistance;
    await _open.animateTo(lift, duration: const Duration(milliseconds: 200), curve: Motion.glide);
    if (!mounted || _opened || _dragDy != 0) return;
    await _open.animateTo(0, duration: const Duration(milliseconds: 200), curve: Motion.out);
  }

  // ---- Opening -------------------------------------------------------------------------------

  void _openByTap() {
    if (_opened || _crossFading) return;
    _nudgeTimer?.cancel();
    if (widget.entry == SheetEntry.sealedDecayed || Motion.reduced(context)) {
      _crossFadeOpen();
      return;
    }
    _haptics.light();
    _open.animateTo(1, duration: const Duration(milliseconds: 460), curve: Motion.emphasized);
  }

  /// Ritual decay and reduced motion: a short cross-fade from folded to open, no travel.
  void _crossFadeOpen() {
    setState(() => _crossFading = true);
    _fade.duration = Motion.reduced(context) ? Motion.crossFade : const Duration(milliseconds: 160);
    _fade.forward(from: 0).whenComplete(() {
      if (!mounted) return;
      _open.value = 1;
      setState(() => _crossFading = false);
    });
  }

  void _didOpen() {
    _opened = true;
    _nudgeTimer?.cancel();
    _haptics.open();
    widget.onOpened();
    _startReveal();
    setState(() {});
  }

  void _startReveal() {
    if (!mounted) return;
    if (_calm) {
      // Lower, held or reduced motion: everything is simply there, with a quiet fade.
      setState(() {
        _figureIn = true;
        _mobiIn = true;
      });
      _reveal.duration = const Duration(milliseconds: 600);
      if (Motion.reduced(context)) {
        _reveal.value = 1;
      } else {
        _reveal.forward(from: 0.5);
      }
      _announce();
      return;
    }
    _announce();
    _reveal.forward(from: 0);
  }

  /// TalkBack hears the result at once, never after the animation.
  void _announce() {
    final m = widget.model;
    final text = m.isHeld ? '${ResultCopy.heldTitle}. ${ResultCopy.heldBody(m.heldCount)}' : ResultCopy.figureLabel(m.marks, m.maxMarks);
    unawaited(SemanticsService.sendAnnouncement(View.of(context), text, TextDirection.ltr));
  }

  void _onReveal() {
    final t = _reveal.value;
    if (!_figureIn && t >= 0.28) setState(() => _figureIn = true);
    if (!_mobiIn && t >= 0.72) setState(() => _mobiIn = true);
  }

  // ---- Dragging ------------------------------------------------------------------------------

  void _dragStartAt(DragStartDetails d) {
    _nudgeTimer?.cancel();
    _dragDy = 0;
    _dragFromSealed = !_opened;
    if (!_opened) {
      _open.stop();
      _dragStart = _open.value;
      _ticks = (_dragStart / 0.25).floor();
    }
  }

  void _dragUpdate(DragUpdateDetails d) {
    _dragDy += d.delta.dy;
    if (_opened || _crossFading) return;
    if (widget.entry == SheetEntry.sealedDecayed) return;
    final p = (_dragStart - _dragDy / SheetStage.dragDistance).clamp(0.0, 1.0);
    _open.value = p;
    final crossed = (p / 0.25).floor().clamp(0, 3);
    if (crossed > _ticks) {
      _ticks = crossed;
      if (_variant != RecapVariant.lower) _haptics.selection();
    } else if (crossed < _ticks) {
      _ticks = crossed;
    }
  }

  void _dragEnd(DragEndDetails d) {
    final v = d.primaryVelocity ?? 0;
    final dy = _dragDy;
    final fromSealed = _dragFromSealed;
    _dragDy = 0;
    _dragFromSealed = false;
    if (_opened) {
      // Swipe up always means continue, but not on the drag that just opened the sheet.
      if (!fromSealed && (dy < -56 || v < -600)) widget.onNext();
      return;
    }
    if (_crossFading) return;
    if (widget.entry == SheetEntry.sealedDecayed || Motion.reduced(context)) {
      if (dy < -24 || v < -400) _crossFadeOpen();
      return;
    }
    final p = _open.value;
    if (p >= 0.6 || (v < -800 && p > 0.12)) {
      _open.animateTo(1, duration: const Duration(milliseconds: 220), curve: Motion.out);
    } else {
      _open.animateTo(0, duration: const Duration(milliseconds: 200), curve: Motion.glide);
    }
  }

  // ---- Layout --------------------------------------------------------------------------------

  Widget _sheet(SheetGeometry g, {required Animation<double> open}) {
    final m = widget.model;
    final day = Theme.of(context).brightness == Brightness.light;
    return NightObject(
      child: FoldedSheet(
        shadow: day ? 0.45 : 1,
        geometry: g,
        open: open,
        outside: FlapOutside(model: m, geometry: g),
        inside: FlapInside(model: m, geometry: g, showFigure: _figureIn, rollFigure: !_calm),
        // Nothing in the body reads the unfold, so it is not rebuilt on every frame of it.
        body: SheetBody(geometry: g, cells: m.cells, sealed: !_opened, reveal: _calm ? kAlwaysCompleteAnimation : _ink),
        sweep: _calm ? null : _sweep,
      ),
    );
  }

  Widget? _mobi() {
    if (!_mobiIn) return null;
    return switch (_variant) {
      RecapVariant.firstMock => const Mobi(pose: MobiPose.greet, size: 64, motion: MobiMotion.settle),
      RecapVariant.higher => const Mobi(pose: MobiPose.cheer, size: 64, motion: MobiMotion.hop),
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final footer = MarksFooter(model: m, onNext: widget.onNext, onFirstFix: widget.onFirstFix, mobi: _mobi());
    final controls = SealedControls(
      open: _open,
      onOpen: _opened ? null : _openByTap,
      onWithoutReveal: widget.onWithoutReveal,
      bottomInset: bottomInset,
    );

    final stage = Column(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s20),
            child: LayoutBuilder(
              builder: (context, c) {
                final g = SheetGeometry.fit(maxWidth: c.maxWidth - 40, maxHeight: c.maxHeight - 8, questions: m.cells.length);
                // The sheet rests just above the counts; the space above is where the flap lands.
                return Align(
                  alignment: Alignment.bottomCenter,
                  child: SizedBox(
                    width: g.width,
                    height: g.height,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        if (!_opened)
                          Positioned(
                            left: 0,
                            right: 0,
                            top: 0,
                            height: g.flapHeight - 22,
                            child: AnimatedBuilder(
                              animation: _open,
                              builder: (context, child) => Opacity(opacity: (1 - _open.value * 2.4).clamp(0.0, 1.0), child: child),
                              child: ExcludeSemantics(child: SealedHeadline(model: m)),
                            ),
                          ),
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: _opened ? null : _openByTap,
                          child: _crossFading ? _crossFade(g) : _sheet(g, open: _open),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        Stack(
          alignment: Alignment.bottomCenter,
          children: [
            KeepLaidOut(visible: _opened, opacity: _footer, child: footer),
            KeepLaidOut(visible: !_opened, child: controls),
          ],
        ),
      ],
    );

    return Semantics(
      container: true,
      label: _opened ? null : ResultCopy.sealedLabel(m.mockLabel),
      customSemanticsActions: _opened ? null : {const CustomSemanticsAction(label: ResultCopy.openWithoutReveal): widget.onWithoutReveal},
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onVerticalDragStart: _dragStartAt,
        onVerticalDragUpdate: _dragUpdate,
        onVerticalDragEnd: _dragEnd,
        child: stage,
      ),
    );
  }

  Widget _crossFade(SheetGeometry g) {
    return Stack(
      children: [
        FadeTransition(
          opacity: ReverseAnimation(_fade),
          child: _sheet(g, open: kAlwaysDismissedAnimation),
        ),
        FadeTransition(
          opacity: _fade,
          child: _sheet(g, open: kAlwaysCompleteAnimation),
        ),
      ],
    );
  }
}
