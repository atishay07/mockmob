import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api.dart';
import '../../../core/models/models.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show LateNightLine;
import '../copy.dart';
import '../model/finish_reaction.dart';
import 'numbered_sheet.dart';
import 'practice_app_bar.dart';
import 'plain_notice.dart';

class ResultLoadFailed extends StatelessWidget {
  const ResultLoadFailed({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) =>
      PlainNotice(message: PracticeCopy.resultLoadFailed, tone: BannerTone.error, actionLabel: PracticeCopy.retry, onAction: onRetry);
}

/// The ending after "Finish for now": the sheet is filed. Mobi waves above the student's own
/// sheet, a card with the score and every numbered bubble, which settles into its tray (a 16 dp
/// drop and a slight shrink, 420 ms emphasized); a volt seal sitting on the card's top edge draws
/// its ring and check; then the counts and the receipt line engrave in. About 900 ms in all,
/// inside the 1.6 s before Today takes over. Reduced motion shows the end at once. The receipt
/// line is in the tree from the first frame (only its opacity moves), so a screen reader hears it
/// at once.
class ResultClosing extends StatefulWidget {
  const ResultClosing({super.key, required this.text, this.cells = const [], this.marks});

  final String text;

  /// The student's sheet, in question order. Empty draws the seal and the line alone.
  final List<QuestionCell> cells;

  /// The server's counts, when the screen has them; otherwise they are read off [cells].
  final FinishMarks? marks;

  static const Duration duration = Duration(milliseconds: 900);

  @override
  State<ResultClosing> createState() => _ResultClosingState();
}

class _ResultClosingState extends State<ResultClosing> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: ResultClosing.duration);

  // The beats, as intervals of the whole.
  late final Animation<double> _file = CurvedAnimation(
    parent: _c,
    curve: const Interval(0, 0.47, curve: Motion.emphasized),
  );
  late final Animation<double> _seal = CurvedAnimation(
    parent: _c,
    curve: const Interval(0.28, 0.75, curve: Curves.easeOutCubic),
  );
  late final Animation<double> _line = CurvedAnimation(
    parent: _c,
    curve: const Interval(0.62, 0.93, curve: Motion.glide),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// The marks to show: the server's, or what the sheet itself says.
  FinishMarks? get _marks {
    final given = widget.marks;
    if (given != null) return given;
    final cells = widget.cells;
    if (cells.isEmpty) return null;
    int n(bool Function(QuestionCell) test) => cells.where(test).length;
    return FinishMarks(
      correct: n((c) => c == QuestionCell.right),
      wrong: n((c) => c == QuestionCell.wrong || c == QuestionCell.repaired),
      blank: n((c) => c == QuestionCell.blank),
      total: cells.length,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final marks = _marks;
    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(top: 0, left: 0, right: 0, height: 460, child: IgnorePointer(child: LightField.lamp(context, strength: 0.7))),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Padding(
                    padding: const EdgeInsets.all(MmSpace.s24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Center(child: MobiCharacter(size: 128, entrance: MobiAct.hello, seed: 23)),
                        // The seal rises half its height above the card; this keeps it clear of Mobi.
                        const SizedBox(height: MmSpace.s24 + _FiledSheet.sealSize / 2),
                        AnimatedBuilder(
                          animation: _file,
                          builder: (context, child) {
                            final f = _file.value;
                            return Transform.translate(
                              offset: Offset(0, -16 * (1 - f)),
                              child: Transform.scale(scale: 1.03 - 0.03 * f, child: child),
                            );
                          },
                          child: _FiledSheet(cells: widget.cells, marks: marks, seal: _seal),
                        ),
                        const SizedBox(height: MmSpace.s24),
                        AnimatedBuilder(
                          animation: _line,
                          builder: (context, child) => Opacity(
                            opacity: _line.value,
                            child: Transform.translate(offset: Offset(0, 6 * (1 - _line.value)), child: child),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (marks != null) ...[
                                Text(
                                  PracticeCopy.countsLine(marks.correct, marks.wrong, marks.blank),
                                  textAlign: TextAlign.center,
                                  style: type.lead.copyWith(color: colors.ink),
                                ),
                                const SizedBox(height: MmSpace.s16),
                              ],
                              Semantics(liveRegion: true, child: ReceiptLine(text: widget.text)),
                            ],
                          ),
                        ),
                        const LateNightLine(),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The filed sheet: a raised card with the score and the student's numbered bubbles, and the volt
/// seal sitting on the middle of its top edge.
class _FiledSheet extends StatelessWidget {
  const _FiledSheet({required this.cells, required this.marks, required this.seal});

  final List<QuestionCell> cells;
  final FinishMarks? marks;
  final Animation<double> seal;

  static const double sealSize = 56;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = marks;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ExcludeSemantics(
          child: LitEdge(
            child: DecoratedBox(
              decoration: ShapeDecoration(
                color: colors.raised,
                shape: RoundedSuperellipseBorder(
                  borderRadius: MmRadius.panelAll,
                  side: BorderSide(color: colors.line),
                ),
                shadows: colors.cardShadow,
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s20, sealSize / 2 + MmSpace.s16, MmSpace.s20, MmSpace.s20),
                child: m == null || cells.isEmpty
                    ? const SizedBox(height: MmSpace.s24)
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(
                            child: MonumentalNumber(
                              value: PracticeCopy.figureNumber(m.correct),
                              unit: '  ${PracticeCopy.figureUnit(m.total)}',
                              style: type.figureCompact.copyWith(fontSize: 64),
                              roll: false,
                            ),
                          ),
                          const SizedBox(height: MmSpace.s16),
                          NumberedSheet(cells: cells),
                        ],
                      ),
              ),
            ),
          ),
        ),
        Positioned(
          top: -sealSize / 2,
          left: 0,
          right: 0,
          child: ExcludeSemantics(
            child: Center(
              child: RepaintBoundary(
                child: CustomPaint(
                  size: const Size.square(sealSize),
                  painter: _SealPainter(t: seal, colors: colors),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A volt seal: the disc grows in, a fine ring traces round inside it, then the check draws itself.
class _SealPainter extends CustomPainter {
  _SealPainter({required this.t, required this.colors}) : super(repaint: t);

  final Animation<double> t;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final p = t.value;
    if (p <= 0) return;
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    final disc = Curves.easeOutBack.transform((p / 0.45).clamp(0.0, 1.0));
    canvas
      ..drawCircle(c + const Offset(0, 4), r * disc * 0.92, Paint()..color = colors.voltGlow.withValues(alpha: colors.voltGlow.a * 0.6))
      ..drawCircle(c, r * disc, Paint()..color = colors.volt);
    final ring = (p / 0.7).clamp(0.0, 1.0);
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r - 4),
      -math.pi / 2,
      2 * math.pi * ring,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = colors.voltInk.withValues(alpha: 0.35),
    );
    final check = ((p - 0.4) / 0.6).clamp(0.0, 1.0);
    if (check <= 0) return;
    final a = c + Offset(-r * 0.36, r * 0.02);
    final b = c + Offset(-r * 0.1, r * 0.28);
    final d = c + Offset(r * 0.38, -r * 0.26);
    final first = (b - a).distance;
    final second = (d - b).distance;
    final drawn = (first + second) * Curves.easeOutCubic.transform(check);
    final path = Path()..moveTo(a.dx, a.dy);
    if (drawn <= first) {
      final e = Offset.lerp(a, b, drawn / first)!;
      path.lineTo(e.dx, e.dy);
    } else {
      final e = Offset.lerp(b, d, (drawn - first) / second)!;
      path
        ..lineTo(b.dx, b.dy)
        ..lineTo(e.dx, e.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = colors.voltInk,
    );
  }

  @override
  bool shouldRepaint(_SealPainter old) => old.t != t || old.colors != colors;
}

/// The wait before the finish moment: Mobi holds the student's sheet and reads it, with one
/// plain line. It keeps the moment's height, so nothing jumps when the sheet takes its place.
/// Under reduced motion Mobi holds the reading pose. No skeleton and no blank band.
class ResultReading extends StatelessWidget {
  const ResultReading({super.key, this.centered = false});

  /// On the page of its own (the result is still loading): centred, so the screen is not a
  /// corner and a void. Inside the finish moment's slot it stays at the top.
  final bool centered;

  /// About the height of the finish moment's figure, sheet and Mobi.
  static const double height = 320;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      container: true,
      label: PracticeCopy.readingSheet,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: centered ? 0 : height),
        child: Column(
          crossAxisAlignment: centered ? CrossAxisAlignment.center : CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!centered) const SizedBox(height: MmSpace.s24),
            const MobiCharacter(size: 112, entrance: MobiAct.read, seed: 41),
            const SizedBox(height: MmSpace.s16),
            Text(PracticeCopy.readingSheet, style: type.title, textAlign: centered ? TextAlign.center : null),
            const SizedBox(height: MmSpace.s4),
            Text(
              PracticeCopy.readingSheetNote,
              style: type.small.copyWith(color: colors.ink2),
              textAlign: centered ? TextAlign.center : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// No attempt to show yet: loading, another account's result, offline, or a failed read.
class ResultNoAttempt extends StatelessWidget {
  const ResultNoAttempt({super.key, required this.state, required this.onRetry});

  final RemoteState<AttemptDetail> state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final error = state.error;
    final Widget body;
    if (error == null) {
      body = const Center(
        child: Padding(padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s48), child: ResultReading(centered: true)),
      );
    } else if (error.kind == ApiErrorKind.notFound) {
      body = StateView(
        kind: StateViewKind.error,
        title: PracticeCopy.otherAccount,
        primary: StateAction(PracticeCopy.retry, onRetry),
        secondary: StateAction(PracticeCopy.backToPractice, () => context.go(AppRoutes.practice)),
      );
    } else if (error.isOffline) {
      body = StateView(
        kind: StateViewKind.offline,
        title: PracticeCopy.resultLoadFailedUnknown,
        primary: StateAction(PracticeCopy.retry, onRetry),
        secondary: StateAction(PracticeCopy.backToPractice, () => context.go(AppRoutes.practice)),
      );
    } else {
      body = StateView(
        kind: StateViewKind.error,
        title: PracticeCopy.resultLoadFailedUnknown,
        primary: StateAction(PracticeCopy.retry, onRetry),
        secondary: StateAction(PracticeCopy.backToPractice, () => context.go(AppRoutes.practice)),
      );
    }
    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          // The same lamp the result opens into, so the wait and the result are one room.
          Positioned(top: 0, left: 0, right: 0, height: 440, child: IgnorePointer(child: LightField.lamp(context, strength: 0.75))),
          SafeArea(
            child: Column(
              children: [
                const PracticeAppBar(),
                Expanded(child: body),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
