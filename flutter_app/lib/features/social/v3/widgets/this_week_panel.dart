// The den's This week panel (pass-1020 MOB-MINIMAL 3.1 item 5 and 3.6; build list A4, panel only).
//
// One card, one tap (it opens the This week sheet):
//   - This week's quest: the parcel, "9 more stitches week 4", the server's count "51 of 60", and the
//     12-segment bar in member colours (decoration only: a segment never says who filled it);
//   - the brand's ruler divider;
//   - Mob hours (D171, D174), from `v3.hours`: a lamp stopwatch, "Practice time, this week", the figure
//     "7 h 45 m" in condensed numerals with small units, "of 10 h", a calm 6 dp lamp bar with quarter
//     marks, and a row of Fold heads, each with their time and first name. When nobody shares, one line:
//     "Off for everyone. ..." The whole Mob hours block hides when the server has not shipped it.
//
// Never (3.6): a rank below the top, a member with 0 minutes or opted out, "less" copy, a countdown.
// The app never adds the minutes up itself: the figure is the server's `total_minutes`.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';
import 'quest_segments.dart';

/// Strings local to the panel until the integrator moves them into copy_v3 (V4-den section).
abstract final class ThisWeekPanelCopy {
  static const String you = 'You';
  static String panelSemantics(String quest, String? hours) => hours == null ? '$quest Opens This week.' : '$quest $hours Opens This week.';
}

class ThisWeekPanel extends StatelessWidget {
  const ThisWeekPanel({super.key, required this.v3, this.onTap});

  final MobV3 v3;

  /// Opens the This week sheet.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final q = v3.quest;
    final weeks = v3.mobChain.weeks;
    final hours = v3.hours;
    final palette = [for (final m in v3.members) MobColours.of(context, m.colour)];
    final questLabel = MobV4DenCopy.questSemantics(q, weeks).replaceAll(' Opens This week.', '');
    final hoursLabel = hours == null
        ? null
        : hours.offForEveryone
            ? '${MobV4DenCopy.hoursTitle}. ${MobV4DenCopy.hoursOff}'
            : '${MobV4DenCopy.hoursSemantics(hours.totalMinutes, hours.targetMinutes)} ${[for (final m in hours.members) '${MobV4DenCopy.memberHoursSemantics(_nameOf(m), m.minutes)}.'].join(' ')}';

    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _Head(
          key: const ValueKey('week-quest'),
          icon: Image.asset('assets/art/parcel-sealed.webp', width: 48, height: 48, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 48, height: 48)),
          title: MobV4DenCopy.questTitle,
          line: MobV4DenCopy.questLine(q, weeks),
          figure: _Figure(parts: [('${q.answered}', null)], of: MobV4DenCopy.questOf(q.target)),
        ),
        const SizedBox(height: MmSpace.s12),
        QuestSegments(answered: q.answered, target: q.target, palette: palette),
        if (hours != null) ...[
          const SizedBox(height: MmSpace.s16),
          const RulerDivider(),
          const SizedBox(height: MmSpace.s12),
          _HoursBlock(hours: hours, v3: v3, nameOf: _nameOf),
        ],
      ],
    );

    final card = DecoratedBox(
      key: const ValueKey('this-week-panel'),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.line),
        boxShadow: colors.cardShadow,
      ),
      child: Padding(padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s20, MmSpace.s20), child: body),
    );
    final label = ThisWeekPanelCopy.panelSemantics('$questLabel.', hoursLabel);
    if (onTap == null) return Semantics(container: true, label: label, child: ExcludeSemantics(child: card));
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      pressedScale: 0.985,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.panelAll,
      builder: (context, pressed, _) => ExcludeSemantics(child: card),
    );
  }

  /// "You" for you, else the member's first name as the server sent it (or as the Mob knows it).
  String _nameOf(MobHoursMember m) {
    final member = v3.member(m.memberId);
    if (member?.you ?? false) return ThisWeekPanelCopy.you;
    final n = m.firstName.trim().isNotEmpty ? m.firstName.trim() : (member?.name ?? '');
    return n.split(' ').first;
  }
}

/// A head row: icon tile, title and line, and a figure on the right.
class _Head extends StatelessWidget {
  const _Head({super.key, required this.icon, required this.title, required this.line, this.figure});

  final Widget icon;
  final String title;
  final String line;
  final Widget? figure;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        ExcludeSemantics(child: icon),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(title, style: type.subhead.copyWith(color: colors.ink, fontSize: 17, height: 1.25)),
              const SizedBox(height: MmSpace.s2),
              Text(line, style: type.label.copyWith(color: colors.ink2, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
        if (figure != null) ...[const SizedBox(width: MmSpace.s8), figure!],
      ],
    );
  }
}

/// "51 / of 60", "7 h 45 m / of 10 h": condensed numerals with small units, tabular.
class _Figure extends StatelessWidget {
  const _Figure({required this.parts, required this.of});

  /// (number, unit) pairs; a null unit draws the number alone.
  final List<(String, String?)> parts;
  final String of;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final big = type.figureCompact.copyWith(color: colors.ink, fontSize: 28, height: 1, fontFeatures: const [FontFeature.tabularFigures()]);
    final unit = type.caption.copyWith(color: colors.ink3, fontWeight: FontWeight.w500);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text.rich(
          TextSpan(
            children: [
              for (var i = 0; i < parts.length; i++) ...[
                TextSpan(text: parts[i].$1, style: big),
                if (parts[i].$2 != null) TextSpan(text: ' ${parts[i].$2}${i == parts.length - 1 ? '' : ' '}', style: unit),
              ],
            ],
          ),
          maxLines: 1,
          softWrap: false,
        ),
        const SizedBox(height: MmSpace.s4),
        Text(of, style: unit),
      ],
    );
  }
}

/// The brand's ruler ticks: a small tick every 6 dp, a tall one every 30 dp.
class RulerDivider extends StatelessWidget {
  const RulerDivider({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: CustomPaint(size: const Size(double.infinity, 9), painter: _RulerPainter(colour: colors.ink4.withValues(alpha: 0.75))),
    );
  }
}

class _RulerPainter extends CustomPainter {
  _RulerPainter({required this.colour});

  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = colour
      ..strokeWidth = 1;
    var i = 0;
    for (var x = 0.5; x <= size.width; x += 6, i++) {
      canvas.drawLine(Offset(x, 0), Offset(x, i % 5 == 0 ? size.height : 4), p);
    }
  }

  @override
  bool shouldRepaint(_RulerPainter old) => old.colour != colour;
}

/// The Mob hours block (3.6).
class _HoursBlock extends StatelessWidget {
  const _HoursBlock({required this.hours, required this.v3, required this.nameOf});

  final MobHours hours;
  final MobV3 v3;
  final String Function(MobHoursMember) nameOf;

  static List<(String, String?)> partsOf(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return [if (h > 0) ('$h', 'h'), if (m > 0 || h == 0) ('$m', 'm')];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final off = hours.offForEveryone;
    final icon = Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(color: colors.raised2, borderRadius: BorderRadius.circular(12)),
      alignment: Alignment.center,
      child: Icon(LucideIcons.timer, size: 22, color: colors.lamp),
    );
    return Column(
      key: const ValueKey('week-hours'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _Head(
          icon: icon,
          title: MobV4DenCopy.hoursTitle,
          line: off ? MobV4DenCopy.hoursOff : MobV4DenCopy.hoursLine,
          figure: off ? null : _Figure(parts: partsOf(hours.totalMinutes), of: MobV4DenCopy.hoursOf(hours.targetMinutes)),
        ),
        if (!off) ...[
          const SizedBox(height: MmSpace.s12),
          CalmBar(share: hours.share),
          if (hours.members.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s16),
            _Heads(hours: hours, v3: v3, nameOf: nameOf),
          ],
        ],
      ],
    );
  }
}

/// A calm 6 dp lamp bar with quarter marks: no stripes, no glow. It fills once on glide (600 ms) when it
/// first shows; reduced motion draws the end state.
class CalmBar extends StatelessWidget {
  const CalmBar({super.key, required this.share});

  final double share;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final still = Motion.reduced(context);
    final to = share.clamp(0.0, 1.0);
    return ExcludeSemantics(
      child: SizedBox(
        height: 6,
        child: TweenAnimationBuilder<double>(
          tween: Tween<double>(begin: still ? to : 0, end: to),
          duration: still ? Duration.zero : const Duration(milliseconds: 600),
          curve: Motion.glide,
          builder: (context, v, _) => CustomPaint(
            size: const Size(double.infinity, 6),
            painter: _CalmPainter(share: v, lamp: colors.lamp, track: colors.isNight ? colors.raised2 : colors.sunken, mark: colors.raised, night: colors.isNight),
          ),
        ),
      ),
    );
  }
}

class _CalmPainter extends CustomPainter {
  _CalmPainter({required this.share, required this.lamp, required this.track, required this.mark, required this.night});

  final double share;
  final Color lamp;
  final Color track;
  final Color mark;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Radius.circular(size.height / 2);
    final whole = RRect.fromRectAndRadius(Offset.zero & size, r);
    canvas.drawRRect(whole, Paint()..color = track);
    if (share > 0) {
      final w = size.width * share;
      final fill = Rect.fromLTWH(0, 0, w, size.height);
      canvas.drawRRect(
        RRect.fromRectAndRadius(fill, r),
        Paint()
          ..shader = LinearGradient(colors: [lamp.withValues(alpha: night ? 0.55 : 0.5), lamp.withValues(alpha: 0.95)]).createShader(Rect.fromLTWH(0, 0, size.width, size.height)),
      );
    }
    final m = Paint()..color = mark.withValues(alpha: 0.9);
    for (final q in const [0.25, 0.5, 0.75]) {
      canvas.drawRect(Rect.fromLTWH(size.width * q - 1, 0, 2, size.height), m);
    }
  }

  @override
  bool shouldRepaint(_CalmPainter old) => old.share != share || old.lamp != lamp || old.track != track || old.mark != mark;
}

/// The row of Fold heads, each with their time and first name. Only members who share and have minutes
/// (the server's list, filtered again by the model). At most five (a Mob's seats).
class _Heads extends ConsumerWidget {
  const _Heads({required this.hours, required this.v3, required this.nameOf});

  final MobHours hours;
  final MobV3 v3;
  final String Function(MobHoursMember) nameOf;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final manifest = foldManifestOf(ref);
    final people = hours.members.take(5).toList();
    return LayoutBuilder(
      builder: (context, box) {
        // One row always: four cells, or five when five share (a Mob's seats).
        final cell = math.min(110.0, box.maxWidth / math.max(4, people.length));
        return Wrap(
          spacing: 0,
          runSpacing: MmSpace.s12,
          children: [
            for (final p in people)
              SizedBox(
                width: cell,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _Head34(member: v3.member(p.memberId), head: manifest?.folds[v3.member(p.memberId)?.fold]?.head),
                    const SizedBox(height: MmSpace.s6),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          MobV4DenCopy.hm(p.minutes),
                          maxLines: 1,
                          softWrap: false,
                          style: type.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]),
                        ),
                      ),
                    ),
                    Text(
                      nameOf(p),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: type.caption.copyWith(color: colors.ink3),
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

class _Head34 extends StatelessWidget {
  const _Head34({required this.member, required this.head});

  final MobV3Member? member;
  final String? head;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final m = member;
    const size = 36.0;
    if (head == null) {
      return Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(shape: BoxShape.circle, color: m == null ? colors.raised2 : MobColours.of(context, m.colour)),
        child: Text(m?.initial ?? '?', style: context.mmType.label.copyWith(color: MobColours.inkOn(context), fontWeight: FontWeight.w700)),
      );
    }
    return SizedBox(
      width: size + 6,
      height: size + 6,
      child: Image.asset(head!, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink()),
    );
  }
}
