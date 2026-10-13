import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The top row of a pushed insights page: back, the title, an optional trailing key.
class InsightsHeader extends StatelessWidget {
  const InsightsHeader({super.key, required this.title, required this.fallback, this.trailing, this.caption});

  final String title;

  /// Where back goes when there is nothing to pop (a deep link).
  final String fallback;
  final Widget? trailing;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
      child: Row(
        children: [
          IconButton(
            onPressed: () => context.canPop() ? context.pop() : context.go(fallback),
            tooltip: 'Back',
            icon: Icon(LucideIcons.arrowLeft, color: colors.ink),
          ),
          const SizedBox(width: MmSpace.s4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(header: true, child: Text(title, style: context.mmType.screenTitle, maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (caption != null) Text(caption!, style: context.mmType.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
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
                  const SizedBox(height: 2),
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

/// Depth the website keeps for Pro, said once and quietly: no price, no purchase path.
class ProRow extends StatelessWidget {
  const ProRow(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '$text. Pro.',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.sunken,
          shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.line)),
        ),
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
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 2),
        child: Text(InsightsCopy.proTag, style: context.mmType.label.copyWith(color: colors.ink2, fontSize: 12)),
      ),
    );
  }
}

/// Right, wrong and blank as one bar, in proportion. Each part also has a shape (solid,
/// solid with a darker edge, hatched) so the bar never depends on colour alone.
class MarksBar extends StatelessWidget {
  const MarksBar({super.key, required this.right, required this.wrong, required this.blank, this.height = 12});

  final int right;
  final int wrong;
  final int blank;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(painter: _MarksBarPainter(right: right, wrong: wrong, blank: blank, colors: colors)),
      ),
    );
  }
}

class _MarksBarPainter extends CustomPainter {
  _MarksBarPainter({required this.right, required this.wrong, required this.blank, required this.colors});

  final int right;
  final int wrong;
  final int blank;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final total = right + wrong + blank;
    final r = Radius.circular(size.height / 2);
    final whole = RRect.fromRectAndRadius(Offset.zero & size, r);
    canvas.drawRRect(whole, Paint()..color = colors.sunken);
    if (total == 0) return;
    canvas.save();
    canvas.clipRRect(whole);
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
  bool shouldRepaint(_MarksBarPainter old) => old.right != right || old.wrong != wrong || old.blank != blank || old.colors != colors;
}

/// One legend entry: the bubble that means it, then the words.
class LegendItem extends StatelessWidget {
  const LegendItem({super.key, required this.state, required this.text});

  final BubbleState state;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Bubble(state: state, size: 14, animate: false),
        const SizedBox(width: MmSpace.s6),
        Text(text, style: context.mmType.caption.copyWith(color: context.mmColors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
      ],
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
              const SizedBox(width: MmSpace.s6),
              Icon(LucideIcons.arrowRight, size: 16, color: colors.ink2),
            ],
          ),
        ),
      ),
    );
  }
}

/// A subject's object in its pool of light, so a row says which paper it is at a glance.
class SubjectThumb extends StatelessWidget {
  const SubjectThumb({super.key, required this.subject, this.size = 44});

  final String subject;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (size < 56) return SubjectGlyphTile(subject, size: size.clamp(32, 40));
    final colors = context.mmColors;
    final light = SubjectLight.forSubject(subject)?.of(Theme.of(context).brightness) ?? colors.raised2;
    final object = MmArt.subjectObject(subject);
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [light.withValues(alpha: colors.isNight ? 0.9 : 0.8), light.withValues(alpha: 0)],
              stops: const [0.2, 1],
            ),
          ),
          child: object == null ? null : Center(child: ArtImage(object, width: size * 0.86, height: size * 0.86)),
        ),
      ),
    );
  }
}
