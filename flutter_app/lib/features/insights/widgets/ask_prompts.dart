import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/chapter_ties.dart' show costliestChapters, costliestPlace;
import '../data/insights_models.dart';
import 'edge_fade.dart';
import 'motion_bits.dart';

/// What a prompt asks about. Record intents are answered on the phone from the student's own
/// sessions (free); the others go to the AI through the server's budget guard (1 credit).
enum AskIntent { losing, chapter, pace, week, changes, blank, plan, explain }

class AskPrompt {
  const AskPrompt({required this.intent, required this.text, this.preview});

  final AskIntent intent;

  /// The question as it is sent.
  final String text;

  /// One line from the student's own record that shows the answer is about them. Null when the
  /// record has nothing to say yet: the tile then shows no preview, never a made-up one.
  final String? preview;

  bool get free => intent.index <= AskIntent.blank.index;

  /// What a tile says about itself when the record has no line to show yet, so every tile has
  /// one and the grid keeps its rhythm. It describes the question; it is never a figure.
  String get fallbackPreview => switch (intent) {
        AskIntent.losing => InsightsCopy.previewLosing,
        AskIntent.chapter => InsightsCopy.previewChapter,
        AskIntent.pace => InsightsCopy.previewPace,
        AskIntent.week => InsightsCopy.previewWeek,
        _ => '',
      };
}

String _sec(int s) => s >= 60 ? '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}' : '${s}s';

/// The four record prompts of the stage, in order, each with a live line from [v].
List<AskPrompt> recordPrompts(PrepInsights? v, {bool pro = false}) {
  final ready = v != null && v.isReady;
  // By marks lost; a tie is said, never broken by list order (owner I14).
  final tied = ready ? costliestChapters(v.ranked) : const <ChapterLine>[];
  final top = tied.isEmpty ? null : tied.first;
  // Pace is part of Pro: a free account's tile says nothing of it.
  final p = ready && pro ? v.pace : null;
  final week = ready ? v.thisWeek : null;
  String? paceLine;
  if (p != null && p.usable) {
    final wrong = p.medianWrongSec, right = p.medianRightSec;
    paceLine = wrong != null && right != null ? 'Wrong answers take ${_sec(wrong)}, right ones ${_sec(right)}' : (p.medianSec == null ? null : 'Typical question ${_sec(p.medianSec!)}');
  }
  return [
    AskPrompt(
      intent: AskIntent.losing,
      text: InsightsCopy.promptLosing,
      preview: top == null ? null : '${top.lost} marks slipped in ${costliestPlace([for (final c in tied) c.chapter])}',
    ),
    AskPrompt(
      intent: AskIntent.chapter,
      text: InsightsCopy.promptChapter,
      preview: ready && v.ranked.isNotEmpty ? '${v.ranked.length} ${v.ranked.length == 1 ? 'chapter' : 'chapters'} ranked' : null,
    ),
    AskPrompt(intent: AskIntent.pace, text: InsightsCopy.promptPace, preview: paceLine),
    AskPrompt(
      intent: AskIntent.week,
      text: InsightsCopy.promptWeek,
      preview: week == null
          ? null
          : (week.sessions == 0 ? 'No sessions in the last 7 days' : '${week.sessions} ${week.sessions == 1 ? 'session' : 'sessions'}, ${week.questions} questions in 7 days'),
    ),
  ];
}

/// Record prompts for the follow-up rail (never shown on the stage).
List<AskPrompt> moreRecordPrompts() => const [
      AskPrompt(intent: AskIntent.changes, text: InsightsCopy.promptChanges),
      AskPrompt(intent: AskIntent.blank, text: InsightsCopy.promptBlank),
    ];

/// The two AI prompts, seeded with the student's weakest chapter when the record has one.
List<AskPrompt> openPrompts(PrepInsights? v) {
  final top = v != null && v.isReady && v.ranked.isNotEmpty ? costliestChapters(v.ranked).first.chapter : null;
  return [
    AskPrompt(intent: AskIntent.explain, text: InsightsCopy.promptExplain(top)),
    AskPrompt(intent: AskIntent.plan, text: InsightsCopy.promptPlan(top)),
  ];
}

/// A small group label: the group's name and, beside it or under it when there is no room (large
/// text), a quiet line on what that group costs. No bullet: a hollow circle reads as an unchecked
/// radio.
class AskEyebrow extends StatelessWidget {
  const AskEyebrow(this.label, {super.key, this.note});

  final String label;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s12),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: MmSpace.s8,
        runSpacing: MmSpace.s2,
        children: [
          Semantics(header: true, child: Text(label, style: type.label.copyWith(color: colors.ink, letterSpacing: 0.2))),
          if (note != null) Text(note!, style: type.caption.copyWith(color: colors.ink3)),
        ],
      ),
    );
  }
}

/// A rich prompt: a small drawing of what the question is about, the question, one live line from
/// the student's record. Its cost is said once, on the group. Taps send it.
///
/// [lead] is the screen's first prompt: full width, larger type and the one lit edge, so there is
/// a plain place to start. [wide] lays a full-width tile out in a row (drawing, then the words).
class PromptTile extends ConsumerWidget {
  const PromptTile({super.key, required this.prompt, required this.onTap, this.lead = false, this.wide = false});

  final AskPrompt prompt;
  final VoidCallback onTap;
  final bool lead;
  final bool wide;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final preview = Text(
      prompt.preview ?? prompt.fallbackPreview,
      style: type.caption.copyWith(color: colors.ink3, fontSize: 12.5, height: 17 / 12.5),
    );
    return MmPressable(
      semanticsLabel: 'Ask: ${prompt.text}',
      focusRadius: MmRadius.panelAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) {
        Widget face = FakeGlass(
          pressed: pressed,
          lamp: lead,
          child: Padding(
            padding: EdgeInsets.fromLTRB(MmSpace.s16, lead ? MmSpace.s20 : MmSpace.s16, MmSpace.s16, lead ? MmSpace.s16 : MmSpace.s12),
            child: wide
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      PromptGlyph(intent: prompt.intent),
                      const SizedBox(width: MmSpace.s16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(prompt.text, style: type.labelLarge.copyWith(height: 20 / 15)),
                            const SizedBox(height: MmSpace.s4),
                            preview,
                          ],
                        ),
                      ),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      PromptGlyph(intent: prompt.intent),
                      SizedBox(height: lead ? MmSpace.s16 : MmSpace.s12),
                      Text(
                        prompt.text,
                        style: lead ? type.cardTitle.copyWith(fontSize: 20, height: 25 / 20) : type.labelLarge.copyWith(height: 20 / 15),
                        maxLines: 3,
                      ),
                      if (lead) const SizedBox(height: MmSpace.s8) else const Spacer(),
                      if (!lead) const SizedBox(height: MmSpace.s8),
                      Padding(
                        padding: const EdgeInsets.only(right: MmSpace.s4),
                        // The whole line, wrapped: a chapter name is never cut.
                        child: preview,
                      ),
                    ],
                  ),
          ),
        );
        if (lead) face = LitEdge(child: face);
        return face;
      },
    );
  }
}

/// A wide prompt for questions that need the AI: icon tile, the question, its cost.
class PromptRow extends ConsumerWidget {
  const PromptRow({super.key, required this.prompt, required this.onTap});

  final AskPrompt prompt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final icon = prompt.intent == AskIntent.plan ? LucideIcons.calendarDays : LucideIcons.lightbulb;
    return MmPressable(
      semanticsLabel: 'Ask: ${prompt.text}',
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => FakeGlass(
        borderRadius: MmRadius.keyAll,
        pressed: pressed,
        grain: false,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s16, MmSpace.s12),
            child: Row(
              children: [
                SizedBox.square(
                  dimension: 40,
                  child: DecoratedBox(
                    decoration: BoxDecoration(color: colors.sunken, borderRadius: MmRadius.smallAll, border: Border.all(color: colors.line)),
                    child: Icon(icon, size: 20, color: colors.ink),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(child: Text(prompt.text, style: type.labelLarge.copyWith(fontSize: 14.5, height: 19 / 14.5))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Up to three prompts the student has not asked yet, in one scrolling rail above the composer.
/// Each chip rises 60 ms after the one before, starting [delay] after the rail appears.
class FollowUpRail extends ConsumerWidget {
  const FollowUpRail({super.key, required this.prompts, required this.onTap, this.delay = Duration.zero});

  final List<AskPrompt> prompts;
  final ValueChanged<AskPrompt> onTap;
  final Duration delay;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return EdgeFade(
      child: SizedBox(
      height: MmTarget.min,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        itemCount: prompts.length,
        separatorBuilder: (_, _) => const SizedBox(width: MmSpace.s8),
        itemBuilder: (context, i) {
          final p = prompts[i];
          return RiseIn(
            key: ValueKey(p.text),
            delay: delay + Duration(milliseconds: 60 * i),
            dy: MmSpace.s8,
            duration: Motion.card,
            child: MmPressable(
            semanticsLabel: 'Ask: ${p.text}',
            onTap: () {
              ref.read(hapticsProvider).selection();
              onTap(p);
            },
            builder: (context, pressed, _) => FakeGlass(
              borderRadius: MmRadius.pillAll,
              pressed: pressed,
              grain: false,
              child: Center(
                widthFactor: 1,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
                  child: Row(
                    children: [
                      Text(p.text, style: type.labelLarge.copyWith(fontSize: 14)),
                      if (!p.free) ...[
                        const SizedBox(width: MmSpace.s8),
                        Text(InsightsCopy.costCredit, style: type.caption.copyWith(fontSize: 12, color: colors.ink3)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
            ),
          );
        },
      ),
      ),
    );
  }
}

/// The small drawing on a prompt: what the question looks at, painted in code.
class PromptGlyph extends StatelessWidget {
  const PromptGlyph({super.key, required this.intent});

  final AskIntent intent;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox(width: 60, height: 30, child: CustomPaint(painter: _GlyphPainter(intent, colors))),
    );
  }
}

class _GlyphPainter extends CustomPainter {
  const _GlyphPainter(this.intent, this.colors);

  final AskIntent intent;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    switch (intent) {
      case AskIntent.losing:
        _marks(canvas, size);
      case AskIntent.chapter:
        _ladder(canvas, size);
      case AskIntent.pace:
        _stopwatch(canvas, size);
      case AskIntent.week:
        _week(canvas, size);
      default:
        break;
    }
  }

  /// A marks bar: right, wrong, blank, with the open part hatched.
  void _marks(Canvas canvas, Size size) {
    final h = 12.0;
    final y = (size.height - h) / 2;
    final r = Radius.circular(h / 2);
    final whole = RRect.fromRectAndRadius(Rect.fromLTWH(0, y, size.width, h), r);
    canvas.drawRRect(whole, Paint()..color = colors.sunken);
    canvas.save();
    canvas.clipRRect(whole);
    canvas.drawRect(Rect.fromLTWH(0, y, size.width * 0.52, h), Paint()..color = colors.volt);
    canvas.drawRect(Rect.fromLTWH(size.width * 0.52 + 2, y, size.width * 0.24, h), Paint()..color = colors.wrongMark);
    final hatch = Paint()
      ..color = colors.ink4
      ..strokeWidth = 1.3;
    final x0 = size.width * 0.76 + 2;
    canvas.save();
    canvas.clipRect(Rect.fromLTWH(x0, y, size.width - x0, h));
    for (var x = x0 - h; x < size.width; x += 5) {
      canvas.drawLine(Offset(x, y + h), Offset(x + h, y), hatch);
    }
    canvas.restore();
    canvas.restore();
    // A pin on the wrong part: where the marks went.
    final pin = Offset(size.width * 0.64, y - 3);
    canvas.drawLine(pin, pin.translate(0, -3), Paint()..color = colors.ink2..strokeWidth = 1.4..strokeCap = StrokeCap.round);
  }

  /// A ladder of chapters: the weakest on top, lit.
  void _ladder(Canvas canvas, Size size) {
    final widths = [0.9, 0.62, 0.38];
    for (var i = 0; i < 3; i++) {
      final y = 3.0 + i * 10;
      final w = (size.width - 14) * widths[i];
      canvas.drawCircle(Offset(4, y + 3), 3, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = i == 0 ? colors.wrongMark : colors.lineStrong);
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(14, y, w, 6), const Radius.circular(3)),
        Paint()..color = i == 0 ? colors.wrongMark : colors.ink4.withValues(alpha: 0.55),
      );
    }
  }

  /// A stopwatch with a part of its ring inked.
  void _stopwatch(Canvas canvas, Size size) {
    final c = Offset(size.height / 2 + 2, size.height / 2 + 2);
    final r = size.height / 2 - 3;
    canvas.drawCircle(c, r, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = colors.lineStrong);
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      -math.pi / 2,
      math.pi * 1.35,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.6
        ..strokeCap = StrokeCap.round
        ..color = colors.volt,
    );
    canvas.drawLine(c, c + Offset(math.cos(math.pi * 0.85 - math.pi / 2) * r * 0.7, math.sin(math.pi * 0.85 - math.pi / 2) * r * 0.7), Paint()..color = colors.ink..strokeWidth = 1.6..strokeCap = StrokeCap.round);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: c.translate(0, -r - 3), width: 7, height: 3), const Radius.circular(1.5)), Paint()..color = colors.ink3);
    // A short run of tick marks beside it: time in small steps.
    for (var i = 0; i < 4; i++) {
      final x = size.height + 12 + i * 8.0;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(x, size.height / 2 - (i == 3 ? 9 : 5), 3, i == 3 ? 18 : 10), const Radius.circular(1.5)),
        Paint()..color = i == 3 ? colors.wrongMark : colors.ink4.withValues(alpha: 0.6),
      );
    }
  }

  /// Seven day bubbles: the days that were worked inked.
  void _week(Canvas canvas, Size size) {
    final states = [BubbleState.filled, BubbleState.filled, BubbleState.rest, BubbleState.filled, BubbleState.filled, BubbleState.hollow, BubbleState.hollow];
    final paint = BubblePaint(colors);
    const r = 4.2;
    final step = (size.width - r * 2) / 6;
    for (var i = 0; i < 7; i++) {
      paint.paint(canvas, Offset(r + i * step, size.height / 2), r, states[i]);
    }
  }

  @override
  bool shouldRepaint(_GlyphPainter old) => old.intent != intent || old.colors != colors;
}
