// The quest strip on the den (spec 5.3 D1 "Quest strip", F8): "This week's quest", the count, a
// 12-segment paper bar and the parcel with its contents' silhouette. The bar draws full at the target
// and stays full; the count always shows the server's true total ("70 answered. The quest needed 60.").
// The app never computes the total: [Quest.answered] and [Quest.target] are the server's.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';

class QuestStrip extends ConsumerWidget {
  const QuestStrip({super.key, required this.quest, required this.mobName, this.onTap});

  final Quest quest;
  final String mobName;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final count = MobV3Copy.questCount(quest);
    final strip = Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _QuestParcel(parcel: quest.parcel, size: 44),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.end,
                  spacing: MmSpace.s8,
                  runSpacing: MmSpace.s2,
                  children: [
                    Text(
                      MobV3Copy.questTitle,
                      style: type.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700),
                    ),
                    _Count(quest: quest, text: count),
                  ],
                ),
                const SizedBox(height: MmSpace.s8),
                QuestBar(answered: quest.answered, target: quest.target),
              ],
            ),
          ),
        ],
      ),
    );
    final label = '${MobV3Copy.questTitle}. $count. ${MobV3Copy.parcelHolds(quest.parcel, mobName)}';
    if (onTap == null) {
      return Semantics(
        label: label,
        child: ExcludeSemantics(child: strip),
      );
    }
    return MmPressable(onTap: onTap, semanticsLabel: label, pressedScale: 0.98, focusRadius: BorderRadius.circular(MmRadius.small), builder: (context, pressed, _) => strip);
  }
}

/// "51 of 60 questions" with the figure in the condensed cut; past the goal the whole sentence.
class _Count extends StatelessWidget {
  const _Count({required this.quest, required this.text});

  final Quest quest;
  final String text;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final figure = '${quest.answered}';
    final small = type.caption.copyWith(color: colors.ink2);
    final big = type.figureCompact.copyWith(color: colors.ink, fontSize: 20, height: 1.1);
    if (!text.startsWith(figure)) return Text(text, style: small);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: figure, style: big),
          TextSpan(text: text.substring(figure.length), style: small),
        ],
      ),
    );
  }
}

/// Twelve paper segments. Full at the target and past it (F8); the partly filled segment shows its
/// share. Pure paint.
class QuestBar extends StatelessWidget {
  const QuestBar({super.key, required this.answered, required this.target, this.segments = 12, this.height = 12});

  final int answered;
  final int target;
  final int segments;
  final double height;

  /// The share drawn: 0 to 1, 1 at or past the target.
  static double fillOf(int answered, int target) => target <= 0 ? 1 : (answered / target).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _QuestBarPainter(
          fill: fillOf(answered, target),
          segments: segments,
          on: colors.isNight ? const Color(0xFFD9D1BF) : const Color(0xFF3F3A30),
          off: colors.isNight ? const Color(0xFF2A2721) : const Color(0xFFE4DECF),
          edge: colors.line,
        ),
      ),
    );
  }
}

class _QuestBarPainter extends CustomPainter {
  _QuestBarPainter({required this.fill, required this.segments, required this.on, required this.off, required this.edge});

  final double fill;
  final int segments;
  final Color on;
  final Color off;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    const gap = 4.0;
    final w = (size.width - gap * (segments - 1)) / segments;
    final filled = fill * segments;
    for (var i = 0; i < segments; i++) {
      final r = RRect.fromRectAndRadius(Rect.fromLTWH(i * (w + gap), 0, w, size.height), const Radius.circular(3));
      canvas.drawRRect(r, Paint()..color = off);
      final share = (filled - i).clamp(0.0, 1.0);
      if (share > 0) {
        canvas.save();
        canvas.clipRRect(r);
        canvas.drawRect(Rect.fromLTWH(r.left, 0, w * share, size.height), Paint()..color = on);
        // The paper's lit top edge.
        canvas.drawRect(Rect.fromLTWH(r.left, 0, w * share, 1.2), Paint()..color = Colors.white.withValues(alpha: 0.18));
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(_QuestBarPainter old) => old.fill != fill || old.on != on || old.off != off || old.segments != segments;
}

/// The weekly parcel: a folded paper envelope with a wax-paper seal, and the true silhouette of what it
/// holds peeking over the flap (spec 0.4: the parcel always shows its contents in advance).
class _QuestParcel extends ConsumerWidget {
  const _QuestParcel({required this.parcel, this.size = 44});

  final QuestParcel parcel;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final manifest = foldManifestOf(ref);
    final head = parcel.kind == ParcelKind.fold ? manifest?.folds[parcel.fold]?.head : null;
    final h = size * 0.72;
    return ExcludeSemantics(
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.bottomCenter,
          children: [
            if (head != null)
              Positioned(
                bottom: h * 0.55,
                child: ColorFiltered(
                  colorFilter: ColorFilter.mode(colors.ink4, BlendMode.srcIn),
                  child: Image.asset(head, width: size * 0.56, height: size * 0.56, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                ),
              ),
            Positioned(
              bottom: 0,
              child: CustomPaint(
                size: Size(size, h),
                painter: _EnvelopePainter(night: colors.isNight),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EnvelopePainter extends CustomPainter {
  _EnvelopePainter({required this.night});

  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final paper = night ? const Color(0xFFE6DCC6) : const Color(0xFFF1E6CF);
    final shade = night ? const Color(0xFFC9BB9C) : const Color(0xFFDCCCA9);
    final body = RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, h), const Radius.circular(3));
    canvas.drawRRect(
      body.shift(const Offset(0, 2)),
      Paint()
        ..color = Colors.black.withValues(alpha: night ? 0.35 : 0.10)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.5),
    );
    canvas.drawRRect(body, Paint()..color = paper);
    // The lower flaps.
    final flaps = Path()
      ..moveTo(0, h)
      ..lineTo(w / 2, h * 0.5)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(flaps, Paint()..color = shade.withValues(alpha: 0.55));
    // The top flap, folded down.
    final flap = Path()
      ..moveTo(0, 0)
      ..lineTo(w / 2, h * 0.58)
      ..lineTo(w, 0)
      ..close();
    canvas.drawPath(flap, Paint()..color = shade);
    canvas.drawPath(
      flap,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.12)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.8,
    );
    // The seal: a lamp-amber paper disc where the flap meets.
    canvas.drawCircle(Offset(w / 2, h * 0.55), h * 0.16, Paint()..color = const Color(0xFFC98A2E));
    canvas.drawCircle(Offset(w / 2, h * 0.55), h * 0.09, Paint()..color = const Color(0xFFE0A54A));
  }

  @override
  bool shouldRepaint(_EnvelopePainter old) => old.night != night;
}
