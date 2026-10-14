// One milestone path (papers, repairs, weeks at your goal) as a section of the milestones screen,
// not a card (you-rhythm spec 3.3): its brass token large in its own lamp pool, the path name, "2
// of 3 landed", then a vertical trail with one coin per step joined by a line that draws itself
// volt down to the last landed step. A landed step shows its name and date; the next step is
// ringed and says exactly what lands it and, where the app can count it exactly, how far along
// it is; later steps are named quietly; the record behind the path ends the section. No locks, no
// streak pressure, nothing expires. A step that landed since the last visit is the one T3 moment
// of the screen, played once in order: the token settles, then the step's medal settles with one
// band of light across it, then Mobi stands proud beside the token (he acts after it lands).
//
// Sizes (SPACING.md RH2): the header token is 48 dp with 12 to its words, the rail coins are 36 dp
// centred on the same 48 dp column, so the path name and the steps share one text edge.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/milestone_progress.dart';
import '../logic/milestone_tracks.dart';
import '../logic/tokens.dart';
import 'earned_token.dart';
import 'locked_coin.dart';
import 'medal.dart';
import 'proud_mobi.dart';
import 'rhythm_layout.dart' show FillBar;
import 'rhythm_page.dart' show FlushQuietKey;

/// What is engraved on the coin of each step: nine steps, nine different faces.
({IconData? icon, String? text}) engravingOf(String stepId) => switch (stepId) {
  'first_scored_session' => (icon: null, text: '1'),
  'first_full_mock' => (icon: LucideIcons.fileText, text: null),
  'sessions_10' => (icon: null, text: '10'),
  'first_repair' => (icon: LucideIcons.check, text: null),
  'repairs_5' => (icon: null, text: '5'),
  'repairs_10' => (icon: null, text: '10'),
  'repairs_25' => (icon: null, text: '25'),
  'first_week_met' => (icon: LucideIcons.rotateCw, text: null),
  'weeks_met_4' => (icon: null, text: '4'),
  _ => (icon: LucideIcons.award, text: null),
};

/// The rail: a 48 dp column with a 36 dp coin centred in it. The header token above is 48 dp on
/// the same axis, and every word sits 12 dp right of this column.
const double _rail = 48;
const double _coin = 36;

/// Where the coin starts in its row, leaving 3 dp of air for the rail line above it.
const double _coinTop = 4;

/// The order of a landing, in ms from the first frame: the token settles (0 to about 520), the
/// medal and its band follow (from 280), Mobi arrives once the token has landed (520).
const Duration _medalDelay = Duration(milliseconds: 280);
const Duration _mobiDelay = Duration(milliseconds: 520);

class MilestoneTrackCard extends StatefulWidget {
  const MilestoneTrackCard({
    super.key,
    required this.track,
    required this.dateOf,
    this.progress = const {},
    this.freshIds = const {},
    this.onOpen,
  });

  final TrackView track;

  /// "9 October" for an earned step.
  final String Function(DateTime) dateOf;
  final Map<String, int> progress;
  final Set<String> freshIds;
  final VoidCallback? onOpen;

  @override
  State<MilestoneTrackCard> createState() => _MilestoneTrackCardState();
}

class _MilestoneTrackCardState extends State<MilestoneTrackCard> with SingleTickerProviderStateMixin {
  late final AnimationController _trail = AnimationController(vsync: this, duration: Motion.drawIn);
  bool _started = false;

  MilestoneToken get _token => MilestoneToken.values.firstWhere((t) => t.track == widget.track.track);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _trail.value = 1;
    } else {
      _trail.forward();
    }
  }

  @override
  void dispose() {
    _trail.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final track = widget.track;
    final earned = track.earned.length;
    final total = track.steps.length;
    final next = track.next;
    final count = next == null ? null : widget.progress[next.step.id];
    final target = next == null ? null : milestoneTargets[next.step.id];
    // The newest step of this path that landed since the last visit, if any.
    StepView? landed;
    for (final s in track.earned) {
      if (widget.freshIds.contains(s.step.id) && (landed == null || s.earnedAt!.isAfter(landed.earnedAt!))) landed = s;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _TokenArt(token: _token, earned: earned > 0, justLanded: landed != null),
            SizedBox(width: landed != null ? MmSpace.s4 : MmSpace.s12),
            Expanded(
              child: landed != null
                  // The achievement leads: "5 repairs", then that it just landed, then the path.
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(
                          header: true,
                          child: Text(landed.step.name, style: type.headline.copyWith(fontSize: 30, height: 32 / 30)),
                        ),
                        const SizedBox(height: MmSpace.s4),
                        Semantics(
                          liveRegion: true,
                          label: RhythmCopy.stepJustLanded(landed.step.name),
                          excludeSemantics: true,
                          child: Text(
                            RhythmCopy.justLanded,
                            style: type.small.copyWith(color: colors.accentText, fontWeight: FontWeight.w700),
                          ),
                        ),
                        const SizedBox(height: MmSpace.s2),
                        Text(RhythmCopy.trackLanded(track.track.title, earned, total), style: type.small.copyWith(color: colors.ink2)),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // The path name is a label for the steps under it, so the step in front
                        // (the next one) is the larger line of the section.
                        Semantics(
                          header: true,
                          child: Text(track.track.title, style: type.headline.copyWith(fontSize: 20, height: 24 / 20)),
                        ),
                        const SizedBox(height: MmSpace.s2),
                        Text(RhythmCopy.trackCount(earned, total), style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ),
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s16),
        for (var i = 0; i < track.steps.length; i++)
          _TrailStep(
            view: track.steps[i],
            first: i == 0,
            last: i == track.steps.length - 1,
            segments: track.steps.length - 1,
            index: i,
            trail: _trail,
            nextLanded: i + 1 < track.steps.length && track.steps[i + 1].status == StepStatus.earned,
            dateOf: widget.dateOf,
            fresh: widget.freshIds.contains(track.steps[i].step.id),
            count: track.steps[i].status == StepStatus.next ? count : null,
            target: track.steps[i].status == StepStatus.next ? target : null,
          ),
        if (next == null)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s12),
            child: Text(RhythmCopy.trackComplete, style: type.caption.copyWith(color: colors.ink2)),
          ),
        if (earned > 0 && widget.onOpen != null)
          Align(
            alignment: Alignment.centerLeft,
            child: FlushQuietKey(label: track.track.linkLabel, chevron: true, onPressed: widget.onOpen!),
          ),
      ],
    );
  }
}

class _TokenArt extends StatelessWidget {
  const _TokenArt({required this.token, required this.earned, this.justLanded = false});

  final MilestoneToken token;
  final bool earned;

  /// A step of this path landed since the last visit: the token plays its earned moment.
  final bool justLanded;

  /// The header token: 48 dp, on the rail's axis.
  static const double box = 48;

  /// The token of a step that has just landed is the lead of its moment, so it is larger.
  static const double landedBox = 72;

  /// Mobi beside a landed token: his own column, never over the token.
  static const double mobiSize = 64;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final size = justLanded ? landedBox : box;
    final Widget art;
    if (!earned) {
      art = Center(child: LockedCoin(token, size: box - MmSpace.s4));
    } else if (justLanded) {
      art = Center(child: EarnedToken(size: landedBox, child: ArtImage(token.art, width: landedBox - 14, height: landedBox - 14)));
    } else {
      art = Center(child: ArtImage(token.art, width: box, height: box));
    }
    final coinBox = SizedBox.square(
      dimension: size,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          // The token's own pool of lamp light, fading to the ground. It reaches past the box.
          Positioned(
            left: -MmSpace.s12,
            top: -MmSpace.s12,
            right: -MmSpace.s12,
            bottom: -MmSpace.s12,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      colors.lamp.withValues(alpha: earned ? (colors.isNight ? 0.22 : 0.20) : 0.06),
                      colors.lamp.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          art,
        ],
      ),
    );
    if (!justLanded) return coinBox;
    // Mobi stands against the token's edge, so the achievement and the one celebrating it read as
    // one picture. He arrives after the token has landed.
    // He has his own room beside the token: the box is token + figure, so neither covers the
    // other (at 72 dp tall and 40 dp of room, the token's ring sat over his left side).
    return SizedBox(
      width: landedBox + MmSpace.s4 + MobiFigure.widthFor(mobiSize),
      height: landedBox,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(left: 0, top: 0, child: coinBox),
          const Positioned(right: 0, bottom: -2, child: ProudMobi(size: mobiSize, delay: _mobiDelay)),
        ],
      ),
    );
  }
}

/// One step of the trail: its coin and the line through it on the left, its words on the right.
class _TrailStep extends StatelessWidget {
  const _TrailStep({
    required this.view,
    required this.first,
    required this.last,
    required this.segments,
    required this.index,
    required this.trail,
    required this.nextLanded,
    required this.dateOf,
    required this.fresh,
    this.count,
    this.target,
  });

  final StepView view;
  final bool first;
  final bool last;

  /// Lines on the whole trail (steps - 1) and the index of this step.
  final int segments;
  final int index;
  final Animation<double> trail;

  /// The step after this one landed: the line below this coin is lit.
  final bool nextLanded;
  final String Function(DateTime) dateOf;
  final bool fresh;
  final int? count;
  final int? target;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final name = view.step.name;
    final date = view.earnedAt == null ? null : dateOf(view.earnedAt!);
    final status = view.status;
    final face = engravingOf(view.step.id);
    final label = switch (status) {
      StepStatus.earned => RhythmCopy.stepEarned(name, date!),
      StepStatus.next => RhythmCopy.stepNext(name, view.step.condition),
      StepStatus.later => RhythmCopy.stepLater(name),
    };
    final counted = count != null && target != null;

    // The first line of words is centred on the coin: a 36 dp coin starting 4 dp down, a 22 dp line
    // (24 for the next step, which is larger).
    final lineHeight = status == StepStatus.next ? 24.0 : 22.0;
    final words = Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : MmSpace.s16, top: _coinTop + (_coin - lineHeight) / 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            name,
            style: type.labelLarge.copyWith(
              fontSize: status == StepStatus.next ? 20 : 16,
              fontWeight: status == StepStatus.later ? FontWeight.w500 : (status == StepStatus.next ? FontWeight.w700 : FontWeight.w600),
              color: status == StepStatus.later ? colors.ink3 : colors.ink,
            ),
          ),
          if (date != null) ...[const SizedBox(height: MmSpace.s2), Text(date, style: type.caption.copyWith(color: colors.ink2))],
          if (status == StepStatus.next) ...[
            const SizedBox(height: MmSpace.s2),
            Text(view.step.condition, style: type.small.copyWith(color: colors.ink2)),
            if (counted) ...[const SizedBox(height: MmSpace.s12), _CountBar(count: count!, target: target!)],
          ],
        ],
      ),
    );

    Widget step = Semantics(
      container: true,
      label: label,
      excludeSemantics: true,
      child: ConstrainedBox(
        // Coin (36 plus its 4 dp of air) plus the line between coins, so a one-line step still
        // leaves room for the line.
        constraints: BoxConstraints(minHeight: last ? _coinTop + _coin : 64),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: _rail,
                child: CustomPaint(
                  painter: _LinePainter(
                    colors: colors,
                    trail: trail,
                    segments: segments,
                    index: index,
                    hasTop: !first,
                    hasBottom: !last,
                    topLit: status == StepStatus.earned,
                    bottomLit: nextLanded,
                  ),
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: Padding(
                      padding: const EdgeInsets.only(top: _coinTop),
                      child: Medal(
                        status: switch (status) {
                          StepStatus.earned => MedalStatus.landed,
                          StepStatus.next => MedalStatus.next,
                          StepStatus.later => MedalStatus.later,
                        },
                        icon: face.icon,
                        text: face.text,
                        size: _coin,
                        animateLanding: fresh,
                        delay: _medalDelay,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: words),
            ],
          ),
        ),
      ),
    );
    if (!fresh || Motion.reduced(context)) return step;
    // The row fades in as its medal starts to land, after the token above it.
    final total = _medalDelay + Motion.milestone;
    step = TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      curve: Interval(_medalDelay.inMilliseconds / total.inMilliseconds, 1, curve: Motion.out),
      builder: (context, t, child) => Opacity(opacity: t, child: child),
      child: step,
    );
    return step;
  }
}

/// The vertical line through a step's coin. The segment above the coin is segment `index - 1` of
/// the trail, the one below is segment `index`; a segment is volt when the step below it landed,
/// and a volt segment draws itself down over the trail's 420 ms.
class _LinePainter extends CustomPainter {
  _LinePainter({
    required this.colors,
    required this.trail,
    required this.segments,
    required this.index,
    required this.hasTop,
    required this.hasBottom,
    required this.topLit,
    required this.bottomLit,
  }) : super(repaint: trail);

  final MmColors colors;
  final Animation<double> trail;
  final int segments;
  final int index;
  final bool hasTop;
  final bool hasBottom;
  final bool topLit;
  final bool bottomLit;

  static const double _medalTop = _coinTop;
  static const double _medal = _coin;

  double _seg(int k) => segments <= 0 ? 1 : (trail.value * segments - k).clamp(0.0, 1.0);

  void _line(Canvas canvas, double x, double y0, double y1, Paint base, Paint lit, bool isLit, int k) {
    canvas.drawLine(Offset(x, y0), Offset(x, y1), base);
    if (isLit) canvas.drawLine(Offset(x, y0), Offset(x, y0 + (y1 - y0) * _seg(k)), lit);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final x = size.width / 2;
    final base = Paint()
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..color = colors.lineStrong;
    final lit = Paint()
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..color = colors.accentText;
    if (hasTop) _line(canvas, x, 0, _medalTop - 1, base, lit, topLit, index - 1);
    if (hasBottom) _line(canvas, x, _medalTop + _medal + 3, size.height, base, lit, bottomLit, index);
  }

  @override
  bool shouldRepaint(_LinePainter old) =>
      old.colors != colors ||
      old.index != index ||
      old.hasTop != hasTop ||
      old.hasBottom != hasBottom ||
      old.topLit != topLit ||
      old.bottomLit != bottomLit;
}

/// A thin bar with the exact count beside it. The fill is volt on both themes, with a 1 dp dark
/// volt edge on Daylight so it reads on cream; the track is a well.
class _CountBar extends StatelessWidget {
  const _CountBar({required this.count, required this.target});

  final int count;
  final int target;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      label: RhythmCopy.soFar(count, target),
      excludeSemantics: true,
      child: Row(
        children: [
          Expanded(child: FillBar(fraction: count / target)),
          const SizedBox(width: MmSpace.s12),
          Text(
            RhythmCopy.soFar(count, target),
            style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
