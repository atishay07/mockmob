/// The run's end (the web's `RunEnd.jsx`, A4 3.4 as amended by BUILD-1101 B2 and B7; the same form as the feed's end), the
/// phone's one column, at most 440 dp wide, as lines on the page and no boxes:
///
///   title      the chapter's name (Bricolage 28) and the done line ("All 20 done in 1 min." / "You stopped at 8 of 21."),
///              with Mobi beside them for his one reaction (a nod at 80 percent right, thinking after 3 missed cards)
///   moved      Pro, when the chapter's state moved: a ring filling to the new state, "Holding", "was Getting there"
///   pile       the real card faces this run sent to Revise, fanned (up to four, 96 x 122), "16 in Revise" and the return days
///              ("14 back Wed, 1 back in 20 days"); nothing sent: "No cards went to Revise this time."
///   lines      Key cards, Questions, Old mistakes as the server sends them, only rows with something in them
///   what next  Free after its day: the server's line and See Pro; the lead (its heading, its reason, the volt key); up to
///              three more as hairline rows; Back to the chapter
///
/// Loading is the end's final shape in skeletons and an error says "Your run is saved" with Try again; both are the stage's
/// `EndForm`, so they match the feed's. Every word and number is the server's (`GET /api/learn/runs/:id/end`).
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/json_helpers.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/pressable.dart';
import '../../../core/mascot/mascot.dart';
import '../data/learn_models.dart';
import '../stage/end_form.dart';
import '../stage/stage_balance.dart';
import '../stage/stage_keys.dart';
import '../stage/stage_text.dart';
import 'run_controller.dart';
import 'run_copy.dart';
import 'run_math.dart';
import 'run_view.dart';

/// The end's layer over the frame: Close, then the end's body, scrolling when it is taller than the screen.
class RunEndLayer extends StatelessWidget {
  const RunEndLayer({
    super.key,
    required this.status,
    required this.data,
    required this.kind,
    required this.chapterTitle,
    required this.tally,
    required this.stoppedAt,
    required this.total,
    required this.onClose,
    required this.onRetry,
    required this.onBack,
    required this.canOpen,
    required this.onOpen,
    this.onSeePro,
    this.titleKey,
  });

  final RunEndStatus status;
  final LearnEnd? data;
  final String kind;
  final String chapterTitle;
  final RunTally tally;

  /// How far the student got when they stopped (null: they went to the end).
  final int? stoppedAt;

  /// Items in the run, for the done line when the server sends none.
  final int total;
  final VoidCallback onClose;
  final VoidCallback onRetry;

  /// "Back to the chapter".
  final VoidCallback onBack;

  /// Whether a key of the end leads anywhere (a key that does not is left out).
  final bool Function(LearnOption option) canOpen;
  final ValueChanged<LearnOption> onOpen;

  /// Null leaves "See Pro" out (Pro is not on offer on this phone).
  final VoidCallback? onSeePro;
  final GlobalKey? titleKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final pad = MediaQuery.paddingOf(context);
    final top = pad.top + 16;
    final bottom = pad.bottom + 48;
    final Widget body;
    final d = data;
    if (status == RunEndStatus.loading || status == RunEndStatus.idle) {
      body = const EndForm(title: '', loading: true);
    } else if (status == RunEndStatus.error || d == null) {
      body = EndForm(
        titleKey: titleKey,
        title: '',
        error: (title: RunCopy.endErrorTitle, line: RunCopy.endErrorLine),
        onRetry: onRetry,
        retryKeys: [StageTextKey(label: RunCopy.backToChapter, quiet: true, onTap: onBack)],
      );
    } else {
      body = _Ready(
        data: d,
        kind: kind,
        chapterTitle: chapterTitle,
        tally: tally,
        stoppedAt: stoppedAt,
        total: total,
        canOpen: canOpen,
        onOpen: onOpen,
        onBack: onBack,
        onSeePro: onSeePro,
        titleKey: titleKey,
      );
    }
    return ColoredBox(
      color: colors.ground,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, top, MmSpace.gutter, bottom),
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: EndForm.maxWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Transform.translate(
                    offset: const Offset(-10, 0),
                    child: StageIconKey(icon: LucideIcons.x, size: 20, semanticsLabel: RunCopy.closeLabel, onTap: onClose),
                  ),
                ),
                const SizedBox(height: MmSpace.s12),
                body,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Ready extends StatelessWidget {
  const _Ready({
    required this.data,
    required this.kind,
    required this.chapterTitle,
    required this.tally,
    required this.stoppedAt,
    required this.total,
    required this.canOpen,
    required this.onOpen,
    required this.onBack,
    this.onSeePro,
    this.titleKey,
  });

  final LearnEnd data;
  final String kind;
  final String chapterTitle;
  final RunTally tally;
  final int? stoppedAt;
  final int total;
  final bool Function(LearnOption option) canOpen;
  final ValueChanged<LearnOption> onOpen;
  final VoidCallback onBack;
  final VoidCallback? onSeePro;
  final GlobalKey? titleKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final d = data;
    final recap = kind == LearnKinds.recap;
    final title = RunView.endTitle(d.title.isNotEmpty ? d.title : chapterTitle, kind: kind);
    // The done line: the server's run done when it sends one, else what this screen saw.
    final hasDone = d.raw['done'] is Map;
    final String? doneText = recap
        ? null
        : hasDone
        ? StageText.doneLine(reached: d.done.reached, of: d.done.of, minutes: asJson(d.raw['done'])['minutes'] == null ? null : d.done.minutes)
        : (total > 0 ? StageText.doneLine(reached: stoppedAt ?? total, of: total) : null);
    final moved = RunView.movedParts(d.moved);
    final lines = RunView.endLines(d, kind: kind);
    final lead = d.lead;
    final isFree = lead != null && (lead.go == 'pro' || (lead.line != null && lead.run == null));
    final free = isFree ? RunView.freeEndLines(lead.line) : null;
    final options = [
      for (final o in d.options)
        if (canOpen(o)) o,
    ];
    final leadOption = free != null ? (options.isNotEmpty ? options.first : null) : (lead != null && canOpen(lead) ? lead : null);
    final rest = (free != null ? options.skip(1) : options).take(3).toList();
    final hasCards = kind != LearnKinds.level && !recap;
    final summary = RunView.reviseSummary(d.revisePile);
    final sent = summary.total > 0 ? summary.total : d.reviseCards.length;
    final quiet = type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2);
    final fine = type.body.copyWith(fontSize: 13.5, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink3);
    final titleStyle = type.headline.copyWith(fontSize: 28, height: 1.12, color: colors.ink);
    final large = MediaQuery.textScalerOf(context).scale(16) > 16 * 1.3;
    final lowest = d.level;
    final freeFine = d.free?.text == null ? null : RunView.firstSentence(d.free!.text);

    final left = <Widget>[
      Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (recap && title.lead != null) ...[
                  Text(
                    title.lead!,
                    style: quiet.copyWith(fontSize: 15, fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                  const SizedBox(height: 6),
                ],
                Semantics(
                  key: titleKey,
                  header: true,
                  child: StageBalancedText(TextSpan(text: title.name, style: titleStyle)),
                ),
                if (doneText != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  Text(doneText, style: quiet.copyWith(fontSize: 15.5, fontFeatures: const [FontFeature.tabularFigures()])),
                ],
              ],
            ),
          ),
          if (!large) ...[const SizedBox(width: 12), RunMobi(act: RunMath.endAct(tally))],
        ],
      ),
      if (moved != null) _Moved(from: moved.from, to: moved.to),
      if (hasCards)
        if (sent > 0)
          RunRevisePile(cards: d.reviseCards, count: sent, line: summary.line)
        else
          Text(RunCopy.nothingSent, style: quiet.copyWith(fontSize: 14.5)),
      if (lines.isNotEmpty) _Lines(lines: lines),
      if (recap && lines.isEmpty) _Lines(lines: const [(label: RunCopy.revise, value: RunCopy.recapNothing)]),
      if (lowest != null) Text(RunCopy.levelLine(lowest.title, lowest.right, lowest.of), style: fine),
      if (freeFine != null) Text(freeFine, style: fine),
    ];

    final right = <Widget>[
      if (free != null) _FreeBlock(head: free.head, rest: free.rest, onSeePro: onSeePro),
      if (leadOption != null) _Lead(option: leadOption, onTap: () => onOpen(leadOption)),
      if (rest.isNotEmpty) _OptionRows(options: rest, onOpen: onOpen),
      Align(
        alignment: Alignment.centerLeft,
        child: Transform.translate(
          offset: const Offset(-6, 0),
          child: StageTextKey(label: RunCopy.backToChapter, onTap: onBack),
        ),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, w) in left.indexed) ...[if (i > 0) SizedBox(height: i == 1 && moved != null ? 12 : 22), w],
        const SizedBox(height: 28),
        for (final (i, w) in right.indexed) ...[if (i > 0) const SizedBox(height: 22), w],
      ],
    );
  }
}

// ---------------------------------------------------------------- Mobi

/// Mobi's one reaction on the end, 72 dp: a nod, a lean in, or thinking. Decoration only.
class RunMobi extends StatelessWidget {
  const RunMobi({super.key, required this.act, this.size = 72});

  /// `nod`, `encourage` or `think` (`RunMath.endAct`).
  final String act;
  final double size;

  static MobiAct actFor(String name) => switch (name) {
    'think' => MobiAct.think,
    'nod' => MobiAct.nod,
    _ => MobiAct.encourage,
  };

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: RepaintBoundary(
      child: SizedBox(
        height: size,
        child: MobiCharacter(size: size, entrance: actFor(act), seed: 41),
      ),
    ),
  );
}

// ---------------------------------------------------------------- the chapter moved

/// The ring and the new state: "Holding" in the good colour and "was Getting there". The ring fills from the old state's shape to
/// the new one's in 500 ms (the end's one authored moment); nothing under reduced motion.
class _Moved extends StatefulWidget {
  const _Moved({required this.from, required this.to});

  final String from;
  final String to;

  /// The shapes the state keys draw: how much of the ring is filled.
  static const Map<String, double> fill = {'none': 0, 'thin': 0.12, 'weak': 0.25, 'mid': 0.5, 'strong': 1, 'unknown': 0};
  static const Map<String, String> shape = {
    'none': 'none',
    'thin': 'thin',
    'needs_work': 'weak',
    'getting_there': 'mid',
    'holding': 'strong',
    'unknown': 'unknown',
  };

  static double fillOf(String label) => fill[shape[RunView.stateKeyOf(label)] ?? 'none'] ?? 0;

  @override
  State<_Moved> createState() => _MovedState();
}

class _MovedState extends State<_Moved> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 700), value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final from = _Moved.fillOf(widget.from);
    final to = _Moved.fillOf(widget.to);
    return Semantics(
      label: RunCopy.movedLabel(widget.from, widget.to),
      excludeSemantics: true,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          // The ring fills over 500 ms from 200 ms in; the words fade in with it.
          final v = Motion.out.transform(((_c.value * 700 - 200) / 500).clamp(0.0, 1.0));
          final fade = Motion.out.transform(((_c.value * 700 - 200) / 300).clamp(0.0, 1.0));
          return Row(
            children: [
              SizedBox.square(
                dimension: 24,
                child: CustomPaint(
                  painter: _RingPainter(fill: from + (to - from) * v, color: colors.goodText),
                ),
              ),
              const SizedBox(width: 10),
              Opacity(
                opacity: fade,
                child: Text(widget.to, style: type.title.copyWith(fontSize: 17, height: 1.3, letterSpacing: -0.17, wordSpacing: 0, color: colors.goodText)),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Opacity(
                  opacity: fade,
                  child: Text(
                    RunCopy.movedWas(widget.from),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: type.body.copyWith(fontSize: 13.5, height: 1.3, fontWeight: FontWeight.w500, color: colors.ink3),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({required this.fill, required this.color});

  final double fill;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    canvas.drawCircle(
      c,
      10.5,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = color.withValues(alpha: 0.35),
    );
    if (fill <= 0) return;
    canvas.drawArc(Rect.fromCircle(center: c, radius: 9.2), -math.pi / 2, 2 * math.pi * fill.clamp(0.0, 1.0), true, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.fill != fill || old.color != color;
}

// ---------------------------------------------------------------- the Revise pile

/// The real cards this run sent to Revise, fanned: up to four small card faces (96 x 122, radius 12) by `(i - mid) x 7` degrees
/// and `(i - mid) x 26` dp, opening in 320 ms on `Motion.drawer` with 40 ms steps after 300 ms; the top card shows its kind and
/// its front (five lines), the others three hairlines. Under it "16 in Revise" and the return days.
class RunRevisePile extends StatefulWidget {
  const RunRevisePile({super.key, required this.cards, required this.count, this.line});

  final List<LearnCardFace> cards;
  final int count;

  /// "14 back Wed, 1 back in 20 days".
  final String? line;

  static const double cardWidth = 96;
  static const double cardHeight = 122;
  static const double step = 26;
  static const double height = 138;

  @override
  State<RunRevisePile> createState() => _RunRevisePileState();
}

class _RunRevisePileState extends State<RunRevisePile> with SingleTickerProviderStateMixin {
  static const int delay = 300;
  static const int each = 40;
  static const int span = 320;

  late final AnimationController _open = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: delay + each * 3 + span),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _open.value = 1;
    } else {
      _open.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _open.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = widget.cards.take(4).toList();
    final n = shown.length;
    final mid = (n - 1) / 2;
    final total = _open.duration!.inMilliseconds;
    return Semantics(
      container: true,
      label: RunCopy.reviseLabelOf(widget.count),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (n > 0)
            ExcludeSemantics(
              child: SizedBox(
                height: RunRevisePile.height,
                child: AnimatedBuilder(
                  animation: _open,
                  builder: (context, _) => Stack(
                    clipBehavior: Clip.none,
                    children: [
                      for (final (i, c) in shown.indexed)
                        Builder(
                          builder: (context) {
                            final t = Motion.drawer.transform(((_open.value * total - (delay + each * i)) / span).clamp(0.0, 1.0));
                            final face = StagePileCard.of(kind: c.kind, front: c.front ?? '', id: c.id);
                            return Positioned(
                              left: 20 + RunRevisePile.step * (i * t),
                              top: 6,
                              child: Opacity(
                                opacity: t,
                                child: Transform.rotate(
                                  angle: (i - mid) * t * 7 * math.pi / 180,
                                  alignment: const Alignment(0, 1.4),
                                  child: _PileCard(label: face.label, front: face.front, top: i == n - 1),
                                ),
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ),
            ),
          if (n > 0) const SizedBox(height: 14),
          Text(
            RunCopy.inRevise(widget.count),
            style: type.body.copyWith(
              fontSize: 15,
              height: 1.3,
              fontWeight: FontWeight.w700,
              color: colors.ink,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          if (widget.line != null && widget.line!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              widget.line!,
              style: type.body.copyWith(
                fontSize: 14,
                height: 1.45,
                fontWeight: FontWeight.w500,
                color: colors.ink2,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PileCard extends StatelessWidget {
  const _PileCard({required this.label, required this.front, required this.top});

  final String label;
  final String front;
  final bool top;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Container(
      width: RunRevisePile.cardWidth,
      height: RunRevisePile.cardHeight,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.lineStrong),
        boxShadow: colors.cardShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: top
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: type.label.copyWith(fontSize: 11.5, height: 1.2, fontWeight: FontWeight.w600, color: colors.ink3),
                ),
                const SizedBox(height: 6),
                Flexible(
                  child: Text(
                    front.replaceAll(RegExp(r'_{3,}'), '____'),
                    maxLines: 5,
                    overflow: TextOverflow.ellipsis,
                    style: type.title.copyWith(fontSize: 13, height: 1.28, letterSpacing: 0, wordSpacing: 0, color: colors.ink),
                  ),
                ),
              ],
            )
          : Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final (i, w) in [1.0, 0.7, 0.84].indexed) ...[
                    if (i > 0) const SizedBox(height: 7),
                    FractionallySizedBox(
                      widthFactor: w,
                      child: SizedBox(height: 2, child: ColoredBox(color: colors.lineStrong)),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

// ---------------------------------------------------------------- the lines and what next

/// The hairline rows: a 1 dp line above each row and under the last; the label (112 dp, semibold ink) and the value (ink-2).
class _Lines extends StatelessWidget {
  const _Lines({required this.lines});

  final List<RunEndLine> lines;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final text = type.body.copyWith(
      fontSize: 15,
      height: 1.45,
      fontWeight: FontWeight.w500,
      color: colors.ink2,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, l) in lines.indexed)
          DecoratedBox(
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: colors.line),
                bottom: i == lines.length - 1 ? BorderSide(color: colors.line) : BorderSide.none,
              ),
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 44),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 11),
                child: MergeSemantics(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      SizedBox(
                        width: 112,
                        child: Text(
                          l.label,
                          style: text.copyWith(fontWeight: FontWeight.w600, color: colors.ink),
                        ),
                      ),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(child: Text(l.value, style: text)),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Free after its day's session: the server's two sentences and See Pro (a text key, only where Pro is on offer).
class _FreeBlock extends StatelessWidget {
  const _FreeBlock({required this.head, this.rest, this.onSeePro});

  final String head;
  final String? rest;
  final VoidCallback? onSeePro;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          head,
          style: type.body.copyWith(fontSize: 15.5, height: 1.4, fontWeight: FontWeight.w600, color: colors.ink),
        ),
        if (rest != null && rest!.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            rest!,
            style: type.body.copyWith(fontSize: 14, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2),
          ),
        ],
        if (onSeePro != null)
          Transform.translate(
            offset: const Offset(-6, 0),
            child: StageTextKey(label: RunCopy.seePro, onTap: onSeePro),
          ),
      ],
    );
  }
}

/// The lead: a heading that names it (two lines at most), its reason, and the volt key full width (54 dp). A run's key names
/// its length ("Start 10 minutes"); the reason goes under a key that has no heading.
class _Lead extends StatelessWidget {
  const _Lead({required this.option, required this.onTap});

  final LearnOption option;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final v = RunView.leadView(option);
    if (v == null) return const SizedBox.shrink();
    final reason = v.reason == null
        ? null
        : Text(
            v.reason!,
            style: type.body.copyWith(fontSize: 13.5, height: 1.45, fontWeight: FontWeight.w500, color: colors.ink3),
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (v.heading != null) ...[
          StageBalancedText(
            TextSpan(
              text: v.heading,
              style: type.title.copyWith(fontSize: 17, height: 1.3, letterSpacing: -0.17, wordSpacing: 0, color: colors.ink),
            ),
          ),
          if (reason != null) ...[const SizedBox(height: 6), reason],
        ],
        const SizedBox(height: 8),
        StageStepKey(label: v.key, minHeight: 54, onTap: onTap),
        if (v.heading == null && reason != null) ...[const SizedBox(height: 6), reason],
      ],
    );
  }
}

/// The options under the lead: hairline rows at least 64 dp, the label (semibold 15.5), its reason (ink-3) and a chevron.
class _OptionRows extends StatelessWidget {
  const _OptionRows({required this.options, required this.onOpen});

  final List<LearnOption> options;
  final ValueChanged<LearnOption> onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, o) in options.indexed)
          DecoratedBox(
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: colors.line),
                bottom: i == options.length - 1 ? BorderSide(color: colors.line) : BorderSide.none,
              ),
            ),
            child: MmPressable(
              onTap: () => onOpen(o),
              lift: false,
              pressedScale: 0.99,
              focusRadius: BorderRadius.circular(8),
              highlight: true,
              haptic: MmPressHaptic.selection,
              semanticsLabel: o.evidence == null ? (o.title ?? o.label) : '${o.title ?? o.label}. ${o.evidence}',
              builder: (context, pressed, focused) => ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 64),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              o.title ?? o.label,
                              style: type.body.copyWith(fontSize: 15.5, height: 1.35, fontWeight: FontWeight.w600, color: colors.ink),
                            ),
                            if (o.evidence != null) ...[
                              const SizedBox(height: 3),
                              Text(
                                o.evidence!,
                                style: type.body.copyWith(fontSize: 13.5, height: 1.4, fontWeight: FontWeight.w500, color: colors.ink3),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The recap's own end: "Quick recap of", the chapter's name, what was read, and Study these, Quick recap again and Back.
class RunRecapEnd extends StatelessWidget {
  const RunRecapEnd({
    super.key,
    required this.chapterTitle,
    required this.cards,
    required this.onClose,
    required this.onStudy,
    required this.onAgain,
    required this.onBack,
    this.titleKey,
  });

  final String chapterTitle;

  /// The distinct cards the recap showed.
  final int cards;
  final VoidCallback onClose;
  final VoidCallback onStudy;
  final VoidCallback onAgain;
  final VoidCallback onBack;
  final GlobalKey? titleKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final pad = MediaQuery.paddingOf(context);
    final quiet = type.body.copyWith(
      fontSize: 15,
      height: 1.5,
      fontWeight: FontWeight.w600,
      color: colors.ink2,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return ColoredBox(
      color: colors.ground,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, pad.top + 16, MmSpace.gutter, pad.bottom + 48),
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: EndForm.maxWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Transform.translate(
                    offset: const Offset(-10, 0),
                    child: StageIconKey(icon: LucideIcons.x, size: 20, semanticsLabel: RunCopy.closeLabel, onTap: onClose),
                  ),
                ),
                const SizedBox(height: MmSpace.s12),
                Text(RunCopy.recapLead, style: quiet),
                const SizedBox(height: 6),
                Semantics(
                  key: titleKey,
                  header: true,
                  child: StageBalancedText(
                    TextSpan(
                      text: chapterTitle.isEmpty ? RunCopy.thisChapter : chapterTitle,
                      style: type.headline.copyWith(fontSize: 28, height: 1.12, color: colors.ink),
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                _Lines(lines: [(label: RunCopy.mustKnow, value: RunCopy.recapAll(cards)), (label: RunCopy.revise, value: RunCopy.recapNothing)]),
                const SizedBox(height: 28),
                StageStepKey(label: RunCopy.studyThese(cards), minHeight: 54, onTap: cards > 0 ? onStudy : null),
                const SizedBox(height: 10),
                StageStepKey(label: RunCopy.quickRecapAgain, tone: StageTone.line, onTap: onAgain),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Transform.translate(
                    offset: const Offset(-6, 0),
                    child: StageTextKey(label: RunCopy.backToChapter, onTap: onBack),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
