import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import 'paper.dart';
import 'sheet_geometry.dart';

/// The outside of the folded flap, the face the student sees first: the sheet addressed to them
/// ("Mock 7, Accountancy"), the paper's embossing, the fold notch and the foil seal on the free
/// edge. Drawn upright in its own space; the fold flips it into place.
class FlapOutside extends StatelessWidget {
  const FlapOutside({super.key, required this.model, required this.geometry, this.fade});

  final RecapModel model;
  final SheetGeometry geometry;

  /// The opacity of the words on this face (the paper stays). They are gone before the flap turns
  /// on edge, so they are never seen skewed or cut off by the sheet's edge mid-fold. Null: shown.
  final Animation<double>? fade;

  static const double sealSize = 76;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const notch = 22.0;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: PaperFace(
            notch: PaperNotch.bottomRight,
            texture: true,
            tone: 1,
            child: _Fade(
              opacity: fade,
              child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(ResultCopy.answerSheet, style: type.caption.copyWith(color: colors.ink3, fontSize: 11.5, letterSpacing: 0.4)),
                      const Spacer(),
                      const MmMark(size: 18, tile: false),
                    ],
                  ),
                  const Spacer(),
                  Text(model.mockLabel, style: type.figure.copyWith(fontSize: 44, height: 1)),
                  const SizedBox(height: 2),
                  Text(model.subjectName, style: type.title.copyWith(color: colors.ink2, fontSize: 20)),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: geometry.width * 0.58,
                    child: Text(
                      '${ResultCopy.paperShape(model.questionCount, model.durationMinutes)} ${ResultCopy.submittedAt(model.submittedAt)}',
                      style: type.caption.copyWith(color: colors.ink2),
                    ),
                  ),
                ],
              ),
            ),
            ),
          ),
        ),
        const Positioned(right: 0, bottom: 0, child: FoldedCorner(size: notch)),
        Positioned(
          right: geometry.width * 0.24 - sealSize / 2,
          bottom: -sealSize * 0.1,
          child: const _StampedSeal(child: _Seal(size: sealSize)),
        ),
      ],
    );
  }
}

/// The lime-and-gold foil seal, with its own soft contact shadow on the paper.
class _Seal extends StatelessWidget {
  const _Seal({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: size * 0.1,
            top: size * 0.16,
            child: Container(
              width: size * 0.84,
              height: size * 0.84,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: Color(0x8C000000), blurRadius: 10, offset: Offset(2, 4))],
              ),
            ),
          ),
          Positioned.fill(
            child: ArtImage(
              MmArt.foilSeal,
              width: size,
              height: size,
              placeholder: _CodeSeal(size: size),
            ),
          ),
        ],
      ),
    );
  }
}

/// The foil seal is pressed onto the sheet as it is set down: it lands from 1.22x out of a small
/// turn, 360 ms on the emphasized curve, 380 ms after the sheet arrives. Reduced motion: still.
class _StampedSeal extends StatefulWidget {
  const _StampedSeal({required this.child});

  final Widget child;

  @override
  State<_StampedSeal> createState() => _StampedSealState();
}

class _StampedSealState extends State<_StampedSeal> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 360));
  Timer? _wait;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _wait = Timer(const Duration(milliseconds: 380), () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _wait?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final v = _c.value;
        if (v >= 1) return child!;
        final t = Motion.emphasized.transform(v);
        final s = 1.22 - 0.22 * t;
        return Opacity(
          opacity: (v / 0.35).clamp(0.0, 1.0),
          child: Transform(
            alignment: Alignment.center,
            transform: Matrix4.rotationZ(-0.35 * (1 - t))..scaleByDouble(s, s, 1, 1),
            child: child,
          ),
        );
      },
    );
  }
}

/// If the foil art is missing: a code-drawn volt disc with an engraved ring.
class _CodeSeal extends StatelessWidget {
  const _CodeSeal({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          center: const Alignment(-0.4, -0.5),
          colors: [Color.lerp(colors.volt, Colors.white, 0.3)!, colors.volt, colors.voltEdge],
          stops: const [0, 0.55, 1],
        ),
      ),
      child: SizedBox.square(dimension: size),
    );
  }
}

/// The inside of the flap: the marks box of the answer sheet, where the figure lands.
class FlapInside extends StatelessWidget {
  const FlapInside({super.key, required this.model, required this.geometry, required this.showFigure, this.rollFigure = true, this.meter, this.fade});

  final RecapModel model;
  final SheetGeometry geometry;

  /// The opacity of the words on this face; see [FlapOutside.fade]. They arrive once the flap is
  /// nearly flat. Null: shown.
  final Animation<double>? fade;

  /// The marks meter's fill (0 to 1 of its final length); null draws it full.
  final Animation<double>? meter;

  /// The figure mounts (and rolls) once the sheet is open.
  final bool showFigure;
  final bool rollFigure;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.caption.copyWith(color: colors.ink3, fontSize: 11.5, letterSpacing: 0.4);
    return PaperFace(
      notch: PaperNotch.topRight,
      squareBottom: true,
      child: _Fade(
        opacity: fade,
        child: Padding(
        padding: const EdgeInsets.fromLTRB(20, SheetGeometry.pad, 20, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: SheetGeometry.headerHeight,
              child: Row(
                children: [
                  Flexible(
                    child: Text(model.title, style: label, overflow: TextOverflow.ellipsis),
                  ),
                  const SizedBox(width: 12),
                  Padding(
                    padding: const EdgeInsets.only(right: 14),
                    child: Text(formatDayMonth(model.submittedAt), style: label),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: model.isHeld ? _Held(model: model) : _Figure(model: model, geometry: geometry, show: showFigure, roll: rollFigure),
            ),
            if (!model.isHeld) ...[
              MarksMeter(marks: model.marks, max: model.maxMarks, progress: meter),
              const SizedBox(height: SheetGeometry.meterGap),
            ],
            if (!model.isHeld)
              Text(
                ResultCopy.scheme,
                style: type.caption.copyWith(color: colors.ink3),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
      ),
      ),
    );
  }
}

/// Fades [child] by [opacity] when there is one.
class _Fade extends StatelessWidget {
  const _Fade({required this.opacity, required this.child});

  final Animation<double>? opacity;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final o = opacity;
    return o == null ? child : FadeTransition(opacity: o, child: child);
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.model, required this.geometry, required this.show, required this.roll});

  final RecapModel model;
  final SheetGeometry geometry;
  final bool show;
  final bool roll;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final label = ResultCopy.figureLabel(model.marks, model.maxMarks);
    if (!show) return Semantics(container: true, label: label, child: const SizedBox.expand());
    return Semantics(
      container: true,
      child: Align(
        alignment: Alignment.topLeft,
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.topLeft,
          child: MediaQuery.withNoTextScaling(
            child: MonumentalNumber(
              value: formatSignedNumber(model.marks),
              unit: ResultCopy.outOf(model.maxMarks),
              style: type.figureHero.copyWith(fontSize: geometry.figureSize, height: 0.9),
              roll: roll,
              semanticsLabel: label,
            ),
          ),
        ),
      ),
    );
  }
}

class _Held extends StatelessWidget {
  const _Held({required this.model});

  final RecapModel model;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 4),
        Text(ResultCopy.heldTitle, style: type.headline),
        const SizedBox(height: 6),
        Flexible(
          child: Text(ResultCopy.heldBody(model.heldCount), style: type.small.copyWith(color: colors.ink2)),
        ),
      ],
    );
  }
}

/// The marks as a share of the paper: a 4 dp hairline track with the scored part inked in volt,
/// filling once as the figure lands. Negative marks show an empty track.
class MarksMeter extends StatelessWidget {
  const MarksMeter({super.key, required this.marks, required this.max, this.progress});

  final int marks;
  final int max;
  final Animation<double>? progress;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final share = max <= 0 ? 0.0 : (marks / max).clamp(0.0, 1.0);
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox(
          height: SheetGeometry.meterHeight,
          width: double.infinity,
          child: CustomPaint(
            painter: _MeterPainter(share: share, progress: progress, volt: colors.volt, track: colors.lineStrong),
          ),
        ),
      ),
    );
  }
}

class _MeterPainter extends CustomPainter {
  _MeterPainter({required this.share, required this.progress, required this.volt, required this.track}) : super(repaint: progress);

  final double share;
  final Animation<double>? progress;
  final Color volt;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final h = size.height;
    final r = Radius.circular(h / 2);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, r), Paint()..color = track.withValues(alpha: 0.7));
    final w = size.width * share * (progress?.value ?? 1).clamp(0.0, 1.0);
    if (w <= 0.5) return;
    final rect = Rect.fromLTWH(0, 0, w, h);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, r),
      Paint()..shader = LinearGradient(colors: [Color.lerp(volt, Colors.black, 0.18)!, volt]).createShader(rect),
    );
    // The leading edge catches the lamp.
    canvas.drawCircle(Offset(w - h / 2, h / 2), h * 0.42, Paint()..color = Color.lerp(volt, Colors.white, 0.45)!);
  }

  @override
  bool shouldRepaint(_MeterPainter old) => old.share != share || old.progress != progress || old.volt != volt || old.track != track;
}
