import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'emblem_painter.dart';
import 'emblem_palette.dart';
import 'emblem_subjects.dart';
import 'subject_identity.dart';

/// A subject's emblem: one folded-paper object on a piece of the subject's answer sheet, printed
/// in its form ink, with exactly one volt bubble placed where it means something (the
/// equilibrium point, the nucleus, the ballot's choice).
///
/// - [size] is the side in dp, legible from 24 to 160. Detail follows size (see [EmblemDetail]).
/// - [animate] turns on the idle drift (7.2 s, phase-shifted per subject) and the subject's live
///   detail. Off under reduced motion (system or in-app) and off by default.
/// - [marked] inks the volt bubble; changing it inks or clears it in 260 ms (snaps under reduced
///   motion). The caller owns the haptic (`HapticFeedback.selectionClick`).
/// - [framed] false drops the tile, for an emblem standing on its own light field.
/// - [brightness] overrides the theme's (for a Night card inside a Daylight screen).
///
/// Decorative unless [semanticLabel] is given: the row it sits in names the subject.
class SubjectEmblem extends StatefulWidget {
  const SubjectEmblem({
    super.key,
    required this.subject,
    this.size = 56,
    this.animate = false,
    this.marked = true,
    this.framed = true,
    this.brightness,
    this.semanticLabel,
  });

  /// Any subject id the app meets (`accountancy`, `business_studies`, `gat`, `hindi`, ...).
  final String? subject;
  final double size;
  final bool animate;
  final bool marked;
  final bool framed;
  final Brightness? brightness;
  final String? semanticLabel;

  @override
  State<SubjectEmblem> createState() => _SubjectEmblemState();
}

class _SubjectEmblemState extends State<SubjectEmblem> with TickerProviderStateMixin {
  static const Duration idlePeriod = Duration(milliseconds: 7200);

  AnimationController? _idle;
  late final AnimationController _ink = AnimationController(vsync: this, duration: Motion.ink, value: widget.marked ? 1 : 0);
  final ValueNotifier<double> _still = ValueNotifier<double>(0);
  bool _reduced = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = Motion.reduced(context);
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
    final run = widget.animate && !_reduced;
    if (run) {
      final idle = _idle ??= AnimationController(vsync: this, duration: idlePeriod);
      if (!idle.isAnimating) idle.repeat();
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
    final brightness = widget.brightness ?? Theme.of(context).brightness;
    final identity = SubjectIdentity.of(widget.subject) ?? SubjectIdentity.of('other')!;
    final palette = EmblemPalette.of(identity, brightness);
    final detail = EmblemDetail.forSize(widget.size);
    final art = EmblemArt.forKind(identity.kind);

    Widget emblem = CustomPaint(
      size: Size.square(widget.size),
      isComplex: true,
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
      ),
    );
    if (art == null) {
      emblem = Stack(
        alignment: Alignment.center,
        children: [
          emblem,
          Text(
            SubjectIdentity.monogram(widget.subject),
            textScaler: TextScaler.noScaling,
            style: context.mmType.labelLarge.copyWith(
              fontFamily: 'BricolageTitle',
              fontSize: widget.size * 0.36,
              height: 1,
              fontWeight: FontWeight.w600,
              color: palette.isNight ? palette.lit : palette.deep,
            ),
          ),
        ],
      );
    }
    final boxed = RepaintBoundary(child: SizedBox.square(dimension: widget.size, child: emblem));
    final label = widget.semanticLabel;
    if (label == null) return ExcludeSemantics(child: boxed);
    return Semantics(label: label, image: true, excludeSemantics: true, child: boxed);
  }
}
