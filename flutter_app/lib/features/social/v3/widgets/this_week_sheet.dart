// A4, the This week sheet (Mob V4, MOB-MINIMAL 3.5, 3.6): the Mob's week in one sheet, opened from the pennant
// and the quest panel in the den. It is the chains Mob tab, drawn large:
//   - the pennant with its stitches, and the week's crown on whoever studied the most (Mob hours);
//   - the quest, "What filled it" (by game, never by person), "How it counts" and "Step out this week";
//   - Mob hours per member, with the daily-goal ticks (only when the server sent `v3.hours`);
//   - the milestone path ("On the way"), and a link to Your chain.
//
// Mob hours never ranks below the top, never lists a member with 0 minutes or one who has not shared, never
// counts down and earns nothing. When the server has not shipped hours the whole block is absent.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import 'chain_mob.dart';
import 'sheet_parts.dart';
import 'your_chain_sheet.dart';

/// The week tick: a member who met their own daily goal on this many days of the week gets a tick.
const int _tickDays = 5;

/// Opens This week over the current screen. [onSettings] opens Mob settings from the hours block.
Future<void> showThisWeekSheet(
  BuildContext context, {
  void Function(BuildContext context)? onSettings,
}) => showMmSheet<void>(
  context: context,
  title: MobV4SheetsCopy.thisWeekTitle,
  heightFactor: 0.94,
  builder: (_) => ThisWeekBody(onSettings: onSettings),
);

class ThisWeekBody extends ConsumerWidget {
  const ThisWeekBody({super.key, this.onSettings});

  /// Opens Mob settings from the hours block (the study-time switch lives there). Null: no link is drawn.
  final void Function(BuildContext context)? onSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final den = ref.watch(denViewProvider);
    if (den != null && den.mob == null) {
      // No Mob any more (left or removed): there is no week to show and Try again cannot help, so the sheet goes.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) dropSheet(context);
      });
      return const SizedBox.shrink();
    }
    if (den == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            MobV4SheetsCopy.thisWeekFailed,
            style: context.mmType.title.copyWith(color: context.mmColors.ink),
          ),
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(
            label: MobV3Copy.tryAgain,
            onPressed: () => ref.read(mobV3ActionsProvider).refresh(),
          ),
        ],
      );
    }
    final hours = den.v3.hours;
    final chain = ref.watch(chainProvider).value;
    final large = MediaQuery.textScalerOf(context).scale(16) > 18.5;
    return ChainMobBody(
      den: den,
      pennantWidth: large ? 132 : 112,
      crown: hours?.topMember != null,
      afterQuest: hours == null
          ? null
          : MobHoursBlock(den: den, hours: hours, onSettings: onSettings),
      footer: _ChainLink(
        days: chain == null || chain.hidden ? null : chain.days,
      ),
    );
  }
}

/// The link at the foot: Your chain, with the day count when the chain is shown.
class _ChainLink extends StatelessWidget {
  const _ChainLink({required this.days});

  final int? days;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      key: const ValueKey('tw-chain-link'),
      semanticsLabel:
          '${MobV4SheetsCopy.yourChainLink(days)}. ${MobV4SheetsCopy.yourChainLinkLine}.',
      focusRadius: MmRadius.panelAll,
      onTap: () => leaveSheetThen(context, showYourChainSheet),
      builder: (context, pressed, _) => DecoratedBox(
        decoration: BoxDecoration(
          color: Color.lerp(c.raised, c.raised2, pressed ? 0.6 : 0),
          borderRadius: MmRadius.panelAll,
          border: Border.all(color: c.line),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: MmSpace.s16,
              vertical: MmSpace.s12,
            ),
            child: Row(
              children: [
                Icon(LucideIcons.link, size: 22, color: c.ink),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        MobV4SheetsCopy.yourChainLink(days),
                        style: type.subhead.copyWith(color: c.ink),
                      ),
                      Text(
                        MobV4SheetsCopy.yourChainLinkLine,
                        style: type.small.copyWith(color: c.ink2),
                      ),
                    ],
                  ),
                ),
                Icon(LucideIcons.chevronRight, size: 20, color: c.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Mob hours (3.6): the figure in condensed numerals with small units, "of 10 h", a calm 6 dp lamp bar with
/// quarter marks, then each sharing member with their time and the seven daily-goal ticks.
class MobHoursBlock extends StatelessWidget {
  const MobHoursBlock({
    super.key,
    required this.den,
    required this.hours,
    this.onSettings,
  });

  final DenView den;
  final MobHours hours;
  final void Function(BuildContext context)? onSettings;

  MobV3Member? _member(String id) {
    for (final m in den.v3.members) {
      if (m.memberId == id) return m;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final off = hours.offForEveryone;
    // At large text the figure sits under the title, so the title keeps its line.
    final large = MediaQuery.textScalerOf(context).scale(16) > 18.5;
    return MmSurface.plain(
      key: const ValueKey('tw-hours'),
      padding: const EdgeInsets.all(MmSpace.s20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const PaperChip(icon: LucideIcons.timer, size: 44),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(
                        MobV4SheetsCopy.hoursTitle,
                        style: type.subhead,
                      ),
                    ),
                    Text(
                      MobV4SheetsCopy.hoursLine,
                      style: type.small.copyWith(color: c.ink2),
                    ),
                  ],
                ),
              ),
              if (!off && !large) ...[
                const SizedBox(width: MmSpace.s12),
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerRight,
                    child: Semantics(
                      container: true,
                      label: MobV4SheetsCopy.hoursSemantics(
                        hours.totalMinutes,
                        hours.targetMinutes,
                      ),
                      child: ExcludeSemantics(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            _Figure(minutes: hours.totalMinutes),
                            Text(
                              MobV4SheetsCopy.hoursOf(hours.targetMinutes),
                              style: type.small.copyWith(color: c.ink2),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          if (!off && large) ...[
            const SizedBox(height: MmSpace.s12),
            Semantics(
              container: true,
              label: MobV4SheetsCopy.hoursSemantics(
                hours.totalMinutes,
                hours.targetMinutes,
              ),
              child: ExcludeSemantics(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.end,
                  spacing: MmSpace.s8,
                  children: [
                    _Figure(minutes: hours.totalMinutes),
                    Text(
                      MobV4SheetsCopy.hoursOf(hours.targetMinutes),
                      style: type.small.copyWith(color: c.ink2),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (off) ...[
            // Nobody shares (the target is 150 minutes per sharing member, so 0 means nobody).
            const SizedBox(height: MmSpace.s16),
            Text(MobV4SheetsCopy.hoursOffEveryone, style: type.body),
            const SizedBox(height: MmSpace.s4),
            Text(
              hours.meSharing
                  ? MobV4SheetsCopy.hoursYouOn
                  : MobV4SheetsCopy.hoursOffEveryoneNote,
              style: type.small.copyWith(color: c.ink2),
            ),
            if (onSettings != null && !hours.meSharing) ...[
              const SizedBox(height: MmSpace.s4),
              LinkKey(
                label: MobV4SheetsCopy.hoursSettingsLink,
                icon: LucideIcons.settings,
                onPressed: () => onSettings!(context),
              ),
            ],
          ] else ...[
            const SizedBox(height: MmSpace.s16),
            _Bar(fraction: hours.share),
            const SizedBox(height: MmSpace.s16),
            if (hours.noMinutesYet)
              // Somebody shares but the week has only just begun: the figure reads 0 m and the bar is empty.
              Text(
                MobV4SheetsCopy.hoursNoMinutesYet(den.v3.name.text),
                key: const ValueKey('tw-hours-empty'),
                style: type.small.copyWith(color: c.ink2),
              )
            else ...[
              if (hours.topMember case final MobHoursMember top) ...[
                _TopLine(who: _member(top.memberId), top: top),
                const SizedBox(height: MmSpace.s12),
              ],
              for (final m in hours.members)
                _MemberHours(
                  member: m,
                  who: _member(m.memberId),
                  top: m.memberId == hours.topMember?.memberId,
                ),
              const SizedBox(height: MmSpace.s8),
              // The legend in one line: the tick itself, then what it means (D185: visual first).
              Row(
                key: const ValueKey('tw-tick-note'),
                children: [
                  const _TickBadge(),
                  const SizedBox(width: MmSpace.s8),
                  Flexible(
                    child: Text(
                      MobV4SheetsCopy.tickNote,
                      style: type.small.copyWith(color: c.ink2),
                    ),
                  ),
                ],
              ),
            ],
            if (!hours.meSharing) ...[
              const SizedBox(height: MmSpace.s4),
              // One line with its link: "Your hours are hidden. Mob settings" (the switch lives there).
              Wrap(
                key: const ValueKey('tw-hours-you-off'),
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: MmSpace.s8,
                children: [
                  Text(
                    MobV4SheetsCopy.hoursYouOff,
                    style: type.small.copyWith(color: c.ink2),
                  ),
                  if (onSettings != null)
                    IntrinsicWidth(
                      child: LinkKey(
                        label: MobV4SheetsCopy.hoursSettingsLink,
                        onPressed: () => onSettings!(context),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }
}

/// "7 h 45 m": condensed numerals with the units small. Zero reads "0 m".
class _Figure extends StatelessWidget {
  const _Figure({required this.minutes});

  final int minutes;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final h = minutes ~/ 60;
    final r = minutes % 60;
    final big = type.figure.copyWith(fontSize: 34, height: 1, color: c.ink);
    final unit = type.body.copyWith(color: c.ink2, fontSize: 14);
    return Text.rich(
      TextSpan(
        children: [
          if (h > 0) ...[
            TextSpan(text: '$h', style: big),
            TextSpan(text: ' h', style: unit),
          ],
          if (r > 0 || h == 0) ...[
            if (h > 0) const WidgetSpan(child: SizedBox(width: 6)),
            TextSpan(text: '$r', style: big),
            TextSpan(text: ' m', style: unit),
          ],
        ],
      ),
    );
  }
}

/// The calm lamp bar: it fills from empty to the week's share once (420 ms, the emphasised curve) after the
/// sheet has settled. Reduced motion: it is simply drawn at its share. No glow, no stripes.
class _Bar extends StatefulWidget {
  const _Bar({required this.fraction});

  final double fraction;

  @override
  State<_Bar> createState() => _BarState();
}

class _BarState extends State<_Bar> with SingleTickerProviderStateMixin {
  // 300 ms of stillness while the sheet rises, then 420 ms of fill (no timer: the wait is part of the curve).
  static const Duration _wait = Duration(milliseconds: 300);
  static final Duration _total = _wait + Motion.emphasizedDuration;
  late final AnimationController _c = AnimationController(vsync: this, duration: _total);
  late final Animation<double> _t = CurvedAnimation(
    parent: _c,
    curve: Interval(_wait.inMilliseconds / _total.inMilliseconds, 1, curve: Motion.emphasized),
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

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox(
        height: 6,
        child: AnimatedBuilder(
          animation: _t,
          builder: (context, _) => CustomPaint(
            painter: _BarPainter(
              fraction: widget.fraction * _t.value,
              track: c.sunken,
              fill: c.lamp,
              mark: c.raised,
            ),
          ),
        ),
      ),
    );
  }
}

class _BarPainter extends CustomPainter {
  _BarPainter({
    required this.fraction,
    required this.track,
    required this.fill,
    required this.mark,
  });

  final double fraction;
  final Color track;
  final Color fill;
  final Color mark;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(size.height / 2),
    );
    canvas.drawRRect(r, Paint()..color = track);
    canvas.save();
    canvas.clipRRect(r);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width * fraction, size.height),
      Paint()..color = fill,
    );
    final p = Paint()
      ..color = mark
      ..strokeWidth = 2;
    for (var i = 1; i < 4; i++) {
      final x = size.width * i / 4;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), p);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_BarPainter o) =>
      o.fraction != fraction ||
      o.track != track ||
      o.fill != fill ||
      o.mark != mark;
}

/// The week's crown: "Riya studied the most", on the listed member the server named. It never names someone who
/// is not in the shared list (the name and the minutes both come from [top], a listed member).
class _TopLine extends StatelessWidget {
  const _TopLine({required this.who, required this.top});

  final MobV3Member? who;
  final MobHoursMember top;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final name = who?.you == true
        ? MobV3Copy.tabYou
        : (who?.name ?? top.firstName);
    return Row(
      children: [
        Icon(LucideIcons.crown, size: 20, color: c.lamp),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // One line with the time, one short line under it (as on Week stitched).
              Text(
                MobV4SheetsCopy.hoursTop(name, top.minutes),
                style: type.labelLarge.copyWith(color: c.ink, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              Text(
                MobV4SheetsCopy.hoursTopLine,
                style: type.small.copyWith(color: c.ink2),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MemberHours extends StatelessWidget {
  const _MemberHours({
    required this.member,
    required this.who,
    required this.top,
  });

  final MobHoursMember member;
  final MobV3Member? who;
  final bool top;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final goal = member.goalDays.clamp(0, 7);
    final name = who?.you == true
        ? MobV3Copy.tabYou
        : (who?.name ?? member.firstName);
    return Semantics(
      container: true,
      label: MobV4SheetsCopy.memberHoursSemantics(
        name,
        member.minutes,
        goal,
        top: top,
      ),
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  who == null
                      ? MemberHead(name: name, size: 40)
                      : MemberHead.of(who!, size: 40),
                  if (top)
                    Positioned(
                      right: -4,
                      top: -8,
                      child: Icon(LucideIcons.crown, size: 16, color: c.lamp),
                    ),
                ],
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: type.body.copyWith(
                        color: c.ink,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    _GoalTicks(days: goal),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Text(
                MobV4SheetsCopy.hm(member.minutes),
                style: type.body.copyWith(
                  color: c.ink,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Seven small ticks, one per day of the week, filled volt for the days the member met their own daily goal. The
/// fifth is set a little taller: five of seven earns the week's tick, a 16 dp volt badge with a check.
class _GoalTicks extends StatelessWidget {
  const _GoalTicks({required this.days});

  final int days;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final night = c.isNight;
    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerLeft,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < 7; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Container(
              width: 14,
              height: i == _tickDays - 1 ? 10 : 6,
              decoration: BoxDecoration(
                color: i < days ? c.volt : c.sunken,
                borderRadius: BorderRadius.circular(2),
                border: i < days
                    ? (night ? null : Border.all(color: c.voltEdge))
                    : Border.all(color: c.line),
              ),
            ),
          ],
          if (days >= _tickDays) ...[
            const SizedBox(width: MmSpace.s8),
            const _TickBadge(),
          ],
        ],
      ),
    );
  }
}

/// The week's tick: a 16 dp volt disc with a dark check (the same tick as Week stitched draws on the heads).
class _TickBadge extends StatelessWidget {
  const _TickBadge();

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return Container(
      width: 16,
      height: 16,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: c.volt,
        border: c.isNight ? null : Border.all(color: c.voltEdge),
      ),
      child: Icon(LucideIcons.check, size: 11, color: c.voltInk),
    );
  }
}
