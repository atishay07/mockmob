// A session still open (or a mock that ended while the student was away) holds the hero: the
// answered count as the monumental number, when it ends, whether the server has the answers,
// and one key. Never a ticking clock here: the end time is fixed, so it is written as a time.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/art/art.dart' show SubjectEmblem;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'hero_stage.dart';
import 'number_block.dart';
import 'today_entrance.dart';
import 'today_tones.dart';

class ResumeHeroCard extends StatefulWidget {
  const ResumeHeroCard({super.key, required this.resume, required this.onContinue, this.now});

  final ResumeHero resume;
  final VoidCallback onContinue;

  /// The clock "Saved a minute ago" is read against; the wall clock when null (tests set it).
  final DateTime Function()? now;

  @override
  State<ResumeHeroCard> createState() => _ResumeHeroCardState();
}

class _ResumeHeroCardState extends State<ResumeHeroCard> with SingleTickerProviderStateMixin {
  /// One pulse of light round the card's edge when Continue is pressed (520 ms).
  late final AnimationController _edge = AnimationController(vsync: this, duration: const Duration(milliseconds: 520));

  @override
  void dispose() {
    _edge.dispose();
    super.dispose();
  }

  void _continue() {
    if (!Motion.reduced(context)) _edge.forward(from: 0);
    widget.onContinue();
  }

  @override
  Widget build(BuildContext context) {
    final resume = widget.resume;
    final colors = context.mmColors;
    final type = context.mmType;
    // The open paper's subject stands in the corner as its code-drawn emblem.
    final subject = resume.subjectId;
    final art = subject == null ? null : HeroArtView(art: HeroArt.object(subject: subject));
    final saved = resume.savedAt;
    // With a real save time the card says when the answers were last saved, in words that stay
    // true; the line then carries only when the paper ends.
    final line = saved != null && resume.lead != null ? resume.lead! : resume.line;
    return Stack(
      children: [
        HeroStage(
          subjectId: subject,
          art: art,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Beside the object: the overline, the paper and the answered count, with no hole.
                Padding(
                  padding: EdgeInsets.only(right: art == null ? 0 : heroArtClear - MmSpace.cardPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(TodayCopy.resumeOverline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                      const SizedBox(height: MmSpace.s4),
                      // A two-part title ("Mock 8, Accountancy") takes the title cut, so it stays on
                      // one line beside the object instead of wrapping into the number (audit T5).
                      Semantics(
                        header: true,
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(resume.title, style: resume.title.contains(' ') ? type.title : type.headline, maxLines: 1, softWrap: false),
                        ),
                      ),
                      const SizedBox(height: MmSpace.s12),
                      NumberBlock(
                        number: '${resume.answered}',
                        label: TodayCopy.answeredLabel(resume.total),
                        semanticsLabel: '${resume.answered} of ${resume.total} answered',
                      ),
                    ],
                  ),
                ),
                if (resume.total > 0) ...[
                  const SizedBox(height: MmSpace.s12),
                  // The real answered share of the paper, drawn in as the card arrives.
                  ExcludeSemantics(child: AnsweredLine(answered: resume.answered, total: resume.total)),
                ],
                const SizedBox(height: MmSpace.s8),
                Text(line, style: type.body.copyWith(color: colors.ink2)),
                if (saved != null) ...[
                  const SizedBox(height: 2),
                  SavedAgo(savedAt: saved, now: widget.now),
                ],
                const SizedBox(height: MmSpace.s16),
                KeyButton(label: resume.keyLabel, onPressed: _continue),
              ],
            ),
          ),
        ),
        // The one pulse round the edge when Continue is pressed.
        Positioned.fill(
          child: IgnorePointer(
            child: RepaintBoundary(child: CustomPaint(painter: _EdgePulsePainter(progress: _edge, color: colors.litMark))),
          ),
        ),
      ],
    );
  }
}

/// A 3 dp hairline: the groove of the whole paper and, drawn in over it, the answered share. It
/// draws from the left as the card arrives (after the number lands), once; no entrance, no draw.
class AnsweredLine extends StatelessWidget {
  const AnsweredLine({super.key, required this.answered, required this.total});

  final int answered;
  final int total;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final draw = todayEnterValue(context, delay: const Duration(milliseconds: 320), length: Motion.drawIn);
    return RepaintBoundary(
      child: CustomPaint(
        size: const Size(double.infinity, 3),
        painter: _AnsweredPainter(share: total <= 0 ? 0 : (answered / total).clamp(0.0, 1.0), draw: draw, groove: colors.line, ink: colors.litMark),
      ),
    );
  }
}

class _AnsweredPainter extends CustomPainter {
  _AnsweredPainter({required this.share, required this.draw, required this.groove, required this.ink}) : super(repaint: draw);

  final double share;
  final Animation<double> draw;
  final Color groove;
  final Color ink;

  @override
  void paint(Canvas canvas, Size size) {
    final y = size.height / 2;
    final line = Paint()
      ..strokeWidth = size.height
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(1.5, y), Offset(size.width - 1.5, y), line..color = groove);
    final to = 1.5 + (size.width - 3) * share * Motion.emphasized.transform(draw.value.clamp(0.0, 1.0));
    if (to > 2) canvas.drawLine(Offset(1.5, y), Offset(to, y), line..color = ink);
  }

  @override
  bool shouldRepaint(_AnsweredPainter old) => old.share != share || old.draw != draw || old.groove != groove || old.ink != ink;
}

/// "Saved a minute ago", from the real time the server last acknowledged the answers. The words
/// are re-read as time passes (only where the app's ambient motion is on, so a test never holds
/// a timer), and say nothing a minute-old fact no longer supports.
class SavedAgo extends StatefulWidget {
  const SavedAgo({super.key, required this.savedAt, this.now});

  final DateTime savedAt;
  final DateTime Function()? now;

  @override
  State<SavedAgo> createState() => _SavedAgoState();
}

class _SavedAgoState extends State<SavedAgo> {
  Timer? _timer;

  DateTime get _now => (widget.now ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    if (SubjectEmblem.idleEnabled) {
      _timer = Timer.periodic(const Duration(seconds: 20), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Text(TodayCopy.savedAgo(_now.difference(widget.savedAt)), style: context.mmType.caption.copyWith(color: colors.ink3));
  }
}

class _EdgePulsePainter extends CustomPainter {
  _EdgePulsePainter({required this.progress, required this.color}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final v = progress.value;
    if (v <= 0 || v >= 1) return;
    final e = Motion.emphasized.transform(v);
    final fade = 1 - e;
    final edge = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(heroRadius));
    canvas.drawRRect(
      edge.deflate(0.75),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = color.withValues(alpha: 0.9 * fade),
    );
    canvas.drawRRect(
      edge.inflate(2 * e),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5 * fade
        ..color = color.withValues(alpha: 0.18 * fade),
    );
  }

  @override
  bool shouldRepaint(_EdgePulsePainter old) => old.progress != progress || old.color != color;
}

class EndedHeroCard extends StatelessWidget {
  const EndedHeroCard({super.key, required this.ended, required this.onAction, this.retrying = false, this.demoteAction = false});

  final EndedHero ended;

  /// Tonight's move under the card holds the volt key; this card's own key is a text key.
  final bool demoteAction;
  final void Function(TodayAction action) onAction;

  /// A Try again read is running: a key that retries shows it is working.
  final bool retrying;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return HeroStage(
      subjectId: ended.subjectId,
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(TodayCopy.endedOverline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
            const SizedBox(height: MmSpace.s8),
            Semantics(header: true, child: Text(ended.title, style: type.title)),
            const SizedBox(height: MmSpace.s12),
            Text(ended.line, style: type.body.copyWith(color: colors.ink2)),
            SizedBox(height: demoteAction ? MmSpace.s8 : MmSpace.s20),
            if (demoteAction)
              Align(
                alignment: Alignment.centerLeft,
                child: Transform.translate(
                  offset: const Offset(-MmSpace.s16, 0),
                  child: KeyButton.quiet(label: ended.action.label, onPressed: () => onAction(ended.action)),
                ),
              )
            else
              KeyButton(
                label: ended.action.label,
                onPressed: () => onAction(ended.action),
                loading: retrying && ended.action.target is RetryLoad,
              ),
          ],
        ),
      ),
    );
  }
}
