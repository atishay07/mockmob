import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'emblem_painter.dart';
import 'emblem_palette.dart';
import 'emblem_sizes.dart';
import 'emblem_subjects.dart';
import 'subject_identity.dart';

/// A subject's emblem: one folded-paper object on a piece of the subject's answer sheet, printed
/// in its form ink, with exactly one volt bubble placed where it means something (the
/// equilibrium point, the nucleus, the ballot's choice).
///
/// - [size] is the side in dp, legible from 24 to 160. Use the four sizes of [EmblemSizes]
///   (24, 40, 56, 136) so a subject is the same object on every screen. Detail follows size (see
///   [EmblemDetail]). A size that is not a positive finite number draws nothing and takes no room.
/// - [animate] turns on the idle cycle (7.2 s, phase-shifted per subject): a float on every object
///   and one signature motion per subject (the atom's orbit sweep, the flask's bubbles, the
///   code window's scan, the heads' nod). Off under reduced motion (system or in-app), off by
///   default, paused while the subtree is under `TickerMode(enabled: false)` (an offstage route or
///   tab), and off everywhere until [idleEnabled] is set (the app sets it in `main()`; tests keep
///   it off so `pumpAndSettle` settles).
/// - [marked] inks the volt mark and is off by default, so a row that is not a choice never shows
///   a pick. Changing it inks or clears it in 260 ms (snaps under reduced motion). The caller owns
///   the haptic (`HapticFeedback.selectionClick`). Pair a picked state with a visible check or ring
///   on the card: the ink alone is colour.
/// - [selectable] marks the emblem as a choice (a picker tile). Unmarked it sits slightly small and
///   dimmed; marked it lifts to full size, a framed tile shows a volt ring and a tick in its lower
///   right corner, and the mark is inked. The semantics node reports selected or not (needs
///   [semanticLabel]). Without it [marked] only inks the mark.
/// - The volt mark takes a different form per subject: a key, a clasp, a ring, an ink drop, a swept
///   angle. All of them are the one mark.
/// - [framed] false drops the tile, for an emblem standing on its own light field.
/// - [brightness] overrides the theme's (for a Night card inside a Daylight screen).
///
/// Decorative unless [semanticLabel] is given: the row it sits in names the subject.
class SubjectEmblem extends StatefulWidget {
  const SubjectEmblem({
    super.key,
    required this.subject,
    this.size = EmblemSizes.tile,
    this.animate = false,
    this.marked = false,
    this.selectable = false,
    this.framed = true,
    this.brightness,
    this.semanticLabel,
  });

  /// Any subject id the app meets (`accountancy`, `business_studies`, `gat`, `hindi`, ...).
  final String? subject;
  final double size;
  final bool animate;
  final bool marked;

  /// True where the emblem stands for a choice (a picker tile): the semantics node then reports
  /// selected or not. The caller should pair it with a visible cue other than colour, such as a
  /// check or a ring on the card.
  final bool selectable;
  final bool framed;
  final Brightness? brightness;
  final String? semanticLabel;

  /// The app-wide gate for the idle drift. `main()` turns it on; tests keep the static default
  /// (off) so a screen with an animated emblem settles under `pumpAndSettle`. A test that checks
  /// the drift itself turns it on and restores it in a tear-down.
  static bool idleEnabled = false;

  @override
  State<SubjectEmblem> createState() => _SubjectEmblemState();
}

class _SubjectEmblemState extends State<SubjectEmblem> with TickerProviderStateMixin {
  static const Duration idlePeriod = Duration(milliseconds: 7200);

  AnimationController? _idle;
  late final AnimationController _ink;
  final ValueNotifier<double> _still = ValueNotifier<double>(0);
  bool _reduced = false;
  bool _tickerOn = true;

  @override
  void initState() {
    super.initState();
    // Created here, not on first use: a build that returns early (no room to draw) must still
    // leave a controller to dispose.
    _ink = AnimationController(vsync: this, duration: Motion.ink, value: widget.marked ? 1 : 0);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = Motion.reduced(context);
    _tickerOn = TickerMode.valuesOf(context).enabled;
    _syncIdle();
    if (_reduced && _ink.isAnimating) _ink.value = widget.marked ? 1 : 0;
  }

  @override
  void didUpdateWidget(SubjectEmblem old) {
    super.didUpdateWidget(old);
    // The setting may change in the same frame as the props; read it fresh.
    _reduced = Motion.reduced(context);
    if (old.animate != widget.animate) _syncIdle();
    if (old.marked != widget.marked) {
      final target = widget.marked ? 1.0 : 0.0;
      if (_reduced) {
        _ink.value = target;
      } else {
        _ink.animateTo(target, duration: widget.marked ? Motion.ink : Motion.exitDuration, curve: widget.marked ? Motion.emphasized : Motion.exit);
      }
    }
  }

  void _syncIdle() {
    final run = widget.animate && !_reduced && SubjectEmblem.idleEnabled;
    if (run) {
      final idle = _idle ??= AnimationController(vsync: this, duration: idlePeriod);
      // Offstage (TickerMode off) the drift holds its pose and takes no ticks; it resumes from
      // the same phase when the route or tab is shown again.
      if (!_tickerOn) {
        if (idle.isAnimating) idle.stop(canceled: false);
      } else if (!idle.isAnimating) {
        idle.repeat();
      }
    } else if (_idle != null) {
      _idle!.dispose();
      _idle = null;
    }
  }

  @override
  void dispose() {
    _idle?.dispose();
    _ink.dispose();
    _still.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // A size that is zero, negative, NaN or infinite (a LayoutBuilder with no room, a divide by
    // zero in a caller) takes no space and paints nothing instead of throwing in layout.
    final side = widget.size;
    if (!side.isFinite || side <= 0) return const SizedBox.shrink();
    final brightness = widget.brightness ?? Theme.of(context).brightness;
    final identity = SubjectIdentity.of(widget.subject) ?? SubjectIdentity.of('other')!;
    final palette = EmblemPalette.of(identity, brightness);
    final detail = EmblemDetail.forSize(widget.size);
    final known = EmblemArt.forKind(identity.kind);
    final art = known ?? EmblemArt.monogram;

    Widget emblem = CustomPaint(
      size: Size.square(widget.size),
      isComplex: true,
      // A drifting emblem changes every frame: do not ask the raster cache to keep it.
      willChange: _idle != null,
      painter: EmblemPainter(
        subject: identity,
        art: art,
        palette: palette,
        brightness: brightness,
        detail: detail,
        framed: widget.framed,
        idle: _idle ?? _still,
        ink: _ink,
        inking: () => _ink.isAnimating && _ink.velocity > 0,
        phase: identity.phase,
        selectable: widget.selectable,
      ),
    );
    if (known == null) {
      // Initials on the printed card: heavy, set in the deep ink with a lit edge under them.
      final glyph = detail == EmblemDetail.glyph;
      final fontSize = widget.size * (glyph ? 0.37 : 0.34);
      final letters = SubjectIdentity.monogram(widget.subject);
      Widget letterBox(double k) => Opacity(
            opacity: widget.selectable ? 0.6 + 0.4 * k : 1,
            child: Transform.scale(
              scale: widget.selectable ? (widget.framed ? 0.92 + 0.06 * k : 0.94 + 0.08 * k) : 1,
              child: Align(
                alignment: Alignment(0, (0.42 - 0.5) * 2),
                child: Text(
                  letters,
                  textScaler: TextScaler.noScaling,
                  maxLines: 1,
                  style: context.mmType.labelLarge.copyWith(
                    fontFamily: 'BricolageTitle',
                    fontSize: fontSize,
                    height: 1,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -fontSize * 0.02,
                    color: palette.deep,
                  ),
                ),
              ),
            ),
          );
      emblem = Stack(
        alignment: Alignment.center,
        children: [
          emblem,
          if (widget.selectable) AnimatedBuilder(animation: _ink, builder: (_, _) => letterBox(_ink.value.clamp(0.0, 1.0))) else letterBox(0),
        ],
      );
    }
    final boxed = RepaintBoundary(child: SizedBox.square(dimension: widget.size, child: emblem));
    final label = widget.semanticLabel;
    if (label == null) return ExcludeSemantics(child: boxed);
    return Semantics(
      label: label,
      image: true,
      selected: widget.selectable ? widget.marked : null,
      excludeSemantics: true,
      child: boxed,
    );
  }
}
