// Today 1018's record blocks (TODAY-1018 section 3 rows 6 and 7): Last paper in full (the marks,
// right, wrong and blank as one bar with its words, the biggest leak and its repair) and the
// Repairs and Revise tiles (outlined, because the whole tile is the button: F5). Plus the shared
// section head and the underlined text link.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy_glance.dart';
import '../logic/today_model.dart';

/// A section's head: the title at 19, and one quiet line under it.
class GlanceHead extends StatelessWidget {
  const GlanceHead({super.key, required this.title, this.sub});

  final String title;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: Text(title, style: type.title.copyWith(fontSize: 19))),
        if (sub != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(sub!, style: type.caption.copyWith(fontSize: 14, color: colors.ink2)),
        ],
      ],
    );
  }
}

/// Underlined words that open something: 48 dp tall to touch.
class GlanceLink extends StatelessWidget {
  const GlanceLink({super.key, required this.label, this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.98,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Align(
          widthFactor: 1,
          alignment: Alignment.centerLeft,
          child: Text(
            label,
            style: type.labelLarge.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: pressed ? colors.ink2 : colors.ink,
              // An ink underline, not volt: volt stays on the one lead key (D7, one volt per view).
              decoration: TextDecoration.underline,
              decorationColor: colors.ink3,
              decorationThickness: 1.5,
            ),
          ),
        ),
      ),
    );
  }
}

class LastPaperBlock extends StatelessWidget {
  const LastPaperBlock({super.key, required this.detail, this.onOpen});

  final PaperDetail detail;
  final void Function(TodayTarget target)? onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final d = detail;
    final p = d.paper;
    // A rise is said in the good colour with its words, never in volt.
    final accent = colors.goodText;
    final at = p.up == true && p.change != null ? p.sub.indexOf(p.change!) : -1;
    final subStyle = type.caption.copyWith(fontSize: 13.5, color: colors.ink2);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const GlanceHead(title: GlanceCopy.paperTitle),
        const SizedBox(height: MmSpace.s12),
        MmPressable(
          onTap: onOpen == null ? null : () => onOpen!(p.target),
          semanticsLabel: '${p.title}. ${p.sub}. ${p.marks} ${GlanceCopy.paperBar(d.right, d.wrong, d.blank, d.total)}. ${GlanceCopy.openResult}.',
          focusRadius: MmRadius.smallAll,
          pressedScale: 0.99,
          builder: (context, pressed, _) => Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(p.title, style: type.labelLarge.copyWith(fontSize: 16, fontWeight: FontWeight.w600, color: colors.ink)),
                    const SizedBox(height: 2),
                    Text.rich(
                      at < 0
                          ? TextSpan(text: p.sub)
                          : TextSpan(children: [
                              TextSpan(text: p.sub.substring(0, at)),
                              TextSpan(text: p.change, style: TextStyle(color: accent, fontWeight: FontWeight.w600)),
                              TextSpan(text: p.sub.substring(at + p.change!.length)),
                            ]),
                      style: subStyle,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('${p.marks}', style: type.figureCompact.copyWith(fontSize: 34, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                  const SizedBox(width: MmSpace.s4),
                  Text('of ${p.outOf}', style: type.caption.copyWith(fontSize: 13, color: colors.ink3)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        _Bar(right: d.right, wrong: d.wrong, blank: d.blank),
        const SizedBox(height: MmSpace.s8),
        _Legend(right: d.right, wrong: d.wrong, blank: d.blank, total: d.total),
        if (d.leak != null) ...[
          const SizedBox(height: MmSpace.s12),
          _Leak(text: d.leak!, chapter: d.leakChapter),
        ],
        const SizedBox(height: MmSpace.s8),
        Wrap(
          spacing: MmSpace.s16,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            if (d.leakTarget != null) _Pill(label: GlanceCopy.repairLeak, icon: LucideIcons.wrench, onTap: onOpen == null ? null : () => onOpen!(d.leakTarget!)),
            GlanceLink(label: GlanceCopy.openResult, onTap: onOpen == null ? null : () => onOpen!(p.target)),
          ],
        ),
      ],
    );
  }
}

/// Right, wrong and blank as one bar: ink, the wrong-answer colour, and a quiet track.
class _Bar extends StatelessWidget {
  const _Bar({required this.right, required this.wrong, required this.blank});

  final int right;
  final int wrong;
  final int blank;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final parts = [(right, colors.ink), (wrong, colors.wrongMark), (blank, colors.ink4)];
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: SizedBox(
          height: 8,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var k = 0; k < parts.length; k++)
                if (parts[k].$1 > 0) ...[
                  if (k > 0 && parts.take(k).any((p) => p.$1 > 0)) const SizedBox(width: 2),
                  Expanded(flex: parts[k].$1, child: ColoredBox(color: parts[k].$2)),
                ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.right, required this.wrong, required this.blank, required this.total});

  final int right;
  final int wrong;
  final int blank;
  final int total;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.caption.copyWith(fontSize: 13, color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]);
    Widget key(Color c, String text) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: MmSpace.s6),
            Text(text, style: style),
          ],
        );
    return Semantics(
      label: GlanceCopy.paperBar(right, wrong, blank, total),
      excludeSemantics: true,
      child: Wrap(
        spacing: MmSpace.s12,
        runSpacing: MmSpace.s4,
        children: [
          key(colors.ink, '$right right'),
          key(colors.wrongMark, '$wrong wrong'),
          key(colors.ink4, '$blank blank'),
          Text('of $total', style: style.copyWith(color: colors.ink3)),
        ],
      ),
    );
  }
}

class _Leak extends StatelessWidget {
  const _Leak({required this.text, this.chapter});

  final String text;
  final String? chapter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.body.copyWith(fontSize: 14.5, height: 21 / 14.5, color: colors.ink2);
    final c = chapter;
    final at = c == null ? -1 : text.indexOf(c);
    if (at < 0) return Text(text, style: style);
    return Text.rich(
      TextSpan(children: [
        TextSpan(text: text.substring(0, at)),
        TextSpan(text: c, style: TextStyle(color: colors.ink, fontWeight: FontWeight.w600)),
        TextSpan(text: text.substring(at + c!.length)),
      ]),
      style: style,
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.icon, this.onTap});

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.96,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        height: MmTarget.min,
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.ground.withValues(alpha: colors.isNight ? 0.5 : 0.6),
          shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: colors.ink),
            const SizedBox(width: MmSpace.s8),
            Text(label, style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink)),
          ],
        ),
      ),
    );
  }
}

/// Repairs and Revise (D5, Today's half): two outlined tiles, each the whole button.
class QueueTilesBlock extends StatelessWidget {
  const QueueTilesBlock({super.key, required this.queue, this.onRepairs, this.onRevise});

  final QueueTiles queue;
  final VoidCallback? onRepairs;
  final VoidCallback? onRevise;

  @override
  Widget build(BuildContext context) {
    final q = queue;
    final repairs = q.dayOne
        ? _TileData(GlanceCopy.repairs, null, null, GlanceCopy.queueDayOneRepairs)
        : q.repairsOpen == null
            ? _TileData(GlanceCopy.repairs, null, null, GlanceCopy.repairsUnknown)
            : _TileData(
            GlanceCopy.repairs,
            q.repairsOpen,
            GlanceCopy.openWord,
            q.repairedToCheck > 0 ? GlanceCopy.repairedToCheck(q.repairedToCheck) : GlanceCopy.noneRepaired,
          );
    final due = q.reviseDue;
    final revise = q.dayOne
        ? _TileData(GlanceCopy.revise, null, null, GlanceCopy.queueDayOneRevise)
        : due == null
            ? _TileData(GlanceCopy.revise, null, null, GlanceCopy.reviseUnknown)
            : _TileData(GlanceCopy.revise, due, GlanceCopy.dueToday, due == 0 ? GlanceCopy.reviseNothing : GlanceCopy.reviseFree(q.reviseMinutes));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const GlanceHead(title: GlanceCopy.queueTitle),
        const SizedBox(height: MmSpace.s12),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: _Tile(data: repairs, onTap: onRepairs, tileKey: 'queue-repairs')),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: _Tile(data: revise, onTap: onRevise, tileKey: 'queue-revise')),
            ],
          ),
        ),
      ],
    );
  }
}

class _TileData {
  const _TileData(this.title, this.figure, this.word, this.line);

  final String title;
  final int? figure;
  final String? word;
  final String line;
}

class _Tile extends StatelessWidget {
  const _Tile({required this.data, required this.tileKey, this.onTap});

  final _TileData data;
  final String tileKey;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final d = data;
    return MmPressable(
      key: ValueKey(tileKey),
      onTap: onTap,
      semanticsLabel: GlanceCopy.tileSemantics(d.title, d.figure == null ? '' : '${d.figure} ${d.word}', d.line),
      focusRadius: BorderRadius.circular(20),
      pressedScale: 0.98,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        padding: const EdgeInsets.all(MmSpace.s16),
        decoration: BoxDecoration(
          color: pressed ? colors.raised2 : (colors.isNight ? Color.lerp(colors.raised, colors.ground, 0.35) : colors.raised.withValues(alpha: 0.7)),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: colors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(d.title, style: type.caption.copyWith(fontSize: 13.5, fontWeight: FontWeight.w600, color: colors.ink2)),
            const SizedBox(height: MmSpace.s8),
            if (d.figure != null) ...[
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.end,
                spacing: MmSpace.s6,
                children: [
                  Text('${d.figure}', style: type.figureCompact.copyWith(fontSize: 32, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                  Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(d.word!, style: type.caption.copyWith(fontSize: 14, color: colors.ink))),
                ],
              ),
              const SizedBox(height: MmSpace.s8),
            ],
            Text(d.line, style: type.caption.copyWith(fontSize: 13, height: 18 / 13, color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}
