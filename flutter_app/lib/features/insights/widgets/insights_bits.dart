import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason;
import '../copy.dart';
import '../data/subject_names.dart';
import 'ask_doors.dart' show showInsightsProSheet;

/// The top row of a pushed insights page: the app's one page header ([MmPageHeader]), the back arrow
/// on the gutter, the title, a caption and an optional trailing key.
class InsightsHeader extends StatelessWidget {
  const InsightsHeader({super.key, required this.title, required this.fallback, this.trailing, this.caption, this.closes = false});

  /// A page that opens over the one under it (Ask Mobi): a close mark in place of the back arrow.
  final bool closes;

  final String title;

  /// Where back goes when there is nothing to pop (a deep link).
  final String fallback;
  final Widget? trailing;
  final String? caption;

  @override
  Widget build(BuildContext context) =>
      MmPageHeader(title: title, caption: caption, trailing: trailing, fallbackRoute: fallback, closes: closes);
}

/// A section title with an optional quiet caption under it.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.caption, this.trailing});

  final String title;
  final String? caption;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(header: true, child: Text(title, style: type.title)),
                if (caption != null) ...[
                  const SizedBox(height: MmSpace.s2),
                  Text(caption!, style: type.small.copyWith(color: context.mmColors.ink2)),
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Depth that comes with Pro, said once and quietly. With `PLAY_BILLING` on and a [reason] it is a
/// key: a tap opens the Upgrade sheet with that reason. Otherwise it is as it always was, a line with
/// no price and no purchase path.
class ProRow extends ConsumerWidget {
  const ProRow(this.text, {super.key, this.reason});

  final String text;

  /// What the row is about. A tap opens the Upgrade sheet while Pro can be bought here and a calm
  /// sheet (no price, no link) while it cannot (D101). Null: the row never opens anything.
  final ProReason? reason;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The tag only repeats what the text says, so a text that already names Pro is read once.
    final label = text.contains('Pro') ? '$text.' : '$text. Pro.';
    final opens = reason != null;
    Widget row() => DecoratedBox(
          decoration: ShapeDecoration(
            color: colors.sunken,
            shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.line)),
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: opens ? MmTarget.min : 0),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
              child: Row(
                children: [
                  Icon(LucideIcons.lock, size: 16, color: colors.ink3),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: Text(text, style: type.small.copyWith(color: colors.ink2))),
                  const SizedBox(width: MmSpace.s8),
                  const ProTag(),
                ],
              ),
            ),
          ),
        );
    if (opens) {
      return MmPressable(
        onTap: () => showInsightsProSheet(context, reason!),
        semanticsLabel: label,
        focusRadius: MmRadius.keyAll,
        builder: (context, pressed, focused) => row(),
      );
    }
    return Semantics(container: true, label: label, excludeSemantics: true, child: row());
  }
}

class ProTag extends StatelessWidget {
  const ProTag({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s2),
        child: Text(InsightsCopy.proTag, style: context.mmType.label.copyWith(color: colors.ink2, fontSize: 12)),
      ),
    );
  }
}

/// Right, wrong and blank as one bar, in proportion. Each part also has a shape (solid,
/// solid with a darker edge, hatched) so the bar never depends on colour alone.
///
/// With [engrave], the bar fills left to right once (280 ms) when it first appears and again
/// only when its counts change; never under reduced motion.
class MarksBar extends StatefulWidget {
  const MarksBar({super.key, required this.right, required this.wrong, required this.blank, this.height = 12, this.engrave = false});

  final int right;
  final int wrong;
  final int blank;
  final double height;
  final bool engrave;

  @override
  State<MarksBar> createState() => _MarksBarState();
}

class _MarksBarState extends State<MarksBar> with SingleTickerProviderStateMixin {
  late final AnimationController _fill = AnimationController(vsync: this, duration: Motion.engrave, value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (widget.engrave && !Motion.reduced(context)) _fill.forward(from: 0);
  }

  @override
  void didUpdateWidget(MarksBar old) {
    super.didUpdateWidget(old);
    final same = old.right == widget.right && old.wrong == widget.wrong && old.blank == widget.blank;
    if (same || !widget.engrave) return;
    if (Motion.reduced(context)) {
      _fill.value = 1;
    } else {
      _fill.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _fill.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox(
          height: widget.height,
          width: double.infinity,
          child: AnimatedBuilder(
            animation: _fill,
            builder: (context, _) => CustomPaint(
              painter: _MarksBarPainter(
                right: widget.right,
                wrong: widget.wrong,
                blank: widget.blank,
                colors: colors,
                reach: Motion.out.transform(_fill.value),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MarksBarPainter extends CustomPainter {
  _MarksBarPainter({required this.right, required this.wrong, required this.blank, required this.colors, this.reach = 1});

  final int right;
  final int wrong;
  final int blank;
  final MmColors colors;

  /// How much of the bar's width is engraved so far, 0 to 1.
  final double reach;

  @override
  void paint(Canvas canvas, Size size) {
    final total = right + wrong + blank;
    final r = Radius.circular(size.height / 2);
    final whole = RRect.fromRectAndRadius(Offset.zero & size, r);
    canvas.drawRRect(whole, Paint()..color = colors.sunken);
    if (total == 0 || reach <= 0) return;
    canvas.save();
    canvas.clipRRect(whole);
    canvas.clipRect(Rect.fromLTWH(0, 0, size.width * reach, size.height));
    const gap = 2.0;
    var x = 0.0;
    void part(int n, void Function(Rect rect) draw) {
      if (n == 0) return;
      final w = size.width * n / total;
      final rect = Rect.fromLTWH(x, 0, (w - gap).clamp(1.0, size.width), size.height);
      draw(rect);
      x += w;
    }

    part(right, (rect) {
      canvas.drawRect(rect, Paint()..color = colors.volt);
      if (!colors.isNight) {
        // Volt on paper needs an edge to hold its shape.
        canvas.drawRect(
          rect.deflate(0.5),
          Paint()
            ..style = PaintingStyle.stroke
            ..color = Color.lerp(colors.volt, const Color(0xFF000000), 0.35)!,
        );
      }
    });
    part(wrong, (rect) {
      canvas.drawRect(rect, Paint()..color = colors.wrongMark);
    });
    part(blank, (rect) {
      final hatch = Paint()
        ..color = colors.ink4
        ..strokeWidth = 1.4;
      canvas.save();
      canvas.clipRect(rect);
      for (var hx = rect.left - size.height; hx < rect.right; hx += 5) {
        canvas.drawLine(Offset(hx, rect.bottom), Offset(hx + size.height, rect.top), hatch);
      }
      canvas.restore();
    });
    canvas.restore();
  }

  @override
  bool shouldRepaint(_MarksBarPainter old) =>
      old.right != right || old.wrong != wrong || old.blank != blank || old.colors != colors || old.reach != reach;
}

/// One legend entry: the bubble that means it, then the words.
class LegendItem extends StatelessWidget {
  const LegendItem({super.key, required this.state, required this.text, this.onTap});

  final BubbleState state;
  final String text;

  /// Makes the item a key: pressing it asks the answer sheet to ripple that kind of bubble. Null
  /// leaves it plain text.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Bubble(state: state, size: 14, animate: false),
        const SizedBox(width: MmSpace.s4),
        Text(text, style: context.mmType.caption.copyWith(color: context.mmColors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
      ],
    );
    final tap = onTap;
    if (tap == null) return row;
    return MmPressable(
      onTap: tap,
      semanticsLabel: text,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min - 8),
        child: Align(alignment: Alignment.centerLeft, widthFactor: 1, child: row),
      ),
    );
  }
}

/// A left-aligned text key for the one thing to do about a claim. Quiet, 48 dp tall.
class ActionLink extends StatelessWidget {
  const ActionLink({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        // A text key in ink with a trailing arrow: no underline (a web idiom) and no volt text
        // (it fails contrast on Daylight's paper).
        child: Align(
          alignment: Alignment.centerLeft,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.mmType.labelLarge.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: pressed ? colors.ink2 : colors.ink),
                ),
              ),
              const SizedBox(width: MmSpace.s4),
              Icon(LucideIcons.arrowRight, size: 16, color: colors.ink2),
            ],
          ),
        ),
      ),
    );
  }
}

/// A subject's drawn emblem standing on its own pool of light, so a row says which paper it is at
/// a glance. Unframed: it sits on the row or the plate, never in a tile of its own. A subject id
/// this build has no emblem for gets its initials, never another subject's mark (and is logged so
/// the table can be filled in).
class SubjectThumb extends StatelessWidget {
  const SubjectThumb({super.key, required this.subject, this.size = EmblemSizes.chip});

  final String subject;
  final double size;

  static final Set<String> _logged = {};

  @override
  Widget build(BuildContext context) {
    final known = (isKnownSubject(subject) || isLanguageSubject(subject)) && (SubjectIdentity.of(subject)?.hasEmblem ?? false);
    if (!known) {
      if (_logged.add(subject)) debugPrint('Insights: no subject art for "$subject"; showing its initials');
      return _Monogram(name: subjectDisplayName(subject), size: size);
    }
    return SubjectEmblem(subject: subject, size: size, framed: false);
  }
}

/// A subject's initials on a paper disc.
class _Monogram extends StatelessWidget {
  const _Monogram({required this.name, required this.size});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final words = name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    final letters = words.isEmpty
        ? '?'
        : words.length == 1
            ? words.first.substring(0, words.first.length.clamp(1, 2))
            : '${words[0][0]}${words[1][0]}'.toUpperCase();
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: colors.isNight ? colors.raised2 : colors.sunken,
            border: Border.all(color: colors.line),
          ),
          child: Center(
            child: Text(
              letters,
              textScaler: TextScaler.noScaling,
              style: context.mmType.caption.copyWith(fontSize: math.max(12.0, size * 0.34), fontWeight: FontWeight.w700, color: colors.ink2),
            ),
          ),
        ),
      ),
    );
  }
}


/// The way into Ask from the record: a chat glyph in a round key, what Ask can do with this
/// record, an arrow. A plain row on the ground (no box, no glass), so the hero stays the page's
/// one lit element and the chapter to practise its one dominant action. Mobi himself stands once
/// on the record, on the lead finding, so this row carries no face.
class AskMobiStrip extends StatelessWidget {
  const AskMobiStrip({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: '${InsightsCopy.askKey}. ${InsightsCopy.askStripNote}',
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      pressedScale: 0.99,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Row(
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.isNight ? colors.raised2 : colors.sunken,
                  border: Border.all(color: colors.line),
                ),
                child: SizedBox.square(dimension: 34, child: Icon(LucideIcons.messageCircle, size: 18, color: colors.ink)),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(InsightsCopy.askKey, style: type.cardTitle.copyWith(fontSize: 16)),
                    Text(InsightsCopy.askStripNote, style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              Icon(LucideIcons.arrowRight, size: 18, color: colors.ink2),
            ],
          ),
        ),
      ),
    );
  }
}
