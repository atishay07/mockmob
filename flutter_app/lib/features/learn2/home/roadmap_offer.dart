import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/learn_models.dart';
import '../learn2_balance.dart';
import 'home_copy.dart';
import 'home_entrance.dart';
import 'home_model.dart';
import 'shelf_keys.dart';

/// Learn home's one start offer (the web's RoadmapHero.jsx, R2 ruling 1, LK27), on the app's one hero surface with Mobi
/// (C-LEARN-CALM 2.2, 3 Nov: the web's phone band keeps it as type on the page). The headline, one line, the pick-up's track, one sub line, the page's one volt key and at most two quiet "Or" rows. Every word is the server's
/// `roadmap` (data/learn/roadmap.js); nothing is made up here and no zero is ever drawn. [onOpen] gets the key or the row that was
/// tapped; the caller goes to its run, its feed, Explore or its href. Free's "See Pro" is drawn only where Pro nudges are on
/// ([nudges]); with them off the block is the headline, the line and the rows that still work.
class RoadmapOffer extends StatelessWidget {
  const RoadmapOffer({super.key, required this.roadmap, required this.onOpen, this.nudges = true, this.firstIndex = 0});

  final LearnRoadmap roadmap;
  final ValueChanged<LearnOption> onOpen;
  final bool nudges;

  /// The desk object that leads each kind of Or row (LK60, the web's OR_ICON); null keeps the words alone.
  static BrandIconName? orIcon(String? kind) => switch (kind) {
        'revise' => BrandIconName.revise,
        'fix' => BrandIconName.mistakes,
        'feed' => BrandIconName.feeds,
        'singles' || 'level' => BrandIconName.questions,
        'continue' => BrandIconName.keycards,
        _ => null,
      };

  /// The entrance slot of the block (see [HomeRise]).
  final int firstIndex;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final r = roadmap;
    final key = r.key;
    final keyTarget = HomeModel.target(key);
    final showKey = key != null && keyTarget != null && !(keyTarget is HomeProTarget && !nudges);
    final quiet = r.quiet;
    final quietTarget = HomeModel.target(quiet);
    final showQuiet = quiet != null && quietTarget != null && !(quietTarget is HomeProTarget && !nudges);
    final or = [for (final o in r.or.take(2)) if (HomeModel.target(o) != null) o];
    final line = r.line;
    final sub = r.sub;
    final progress = r.progress;

    final hasTrack = line != null || progress != null || sub != null;
    return HomeRise(
      index: firstIndex,
      child: Padding(
        padding: const EdgeInsets.only(top: 2, bottom: 20),
        // The one hero of Learn (C-LEARN-CALM 2.2): the app's focal surface, as Today's "Up next". Mobi stands beside the
        // progress, in his own box; the headline has the full width.
        child: MmSurface.hero(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Semantics(
            container: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  header: true,
                  // The web's `text-wrap: balance`: two lines are two even lines, never a long one and a word.
                  child: BalancedText(
                    HomeModel.displayTitle(r.headline),
                    key: const ValueKey('lh-offer-title'),
                    style: type.title.copyWith(fontSize: 30, height: 1.12, letterSpacing: -0.03 * 30, color: colors.ink),
                  ),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (line != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 10),
                              child: Text(
                                HomeModel.displayTitle(line),
                                key: const ValueKey('lh-offer-line'),
                                style: type.body.copyWith(fontSize: 16, height: 1.4, fontWeight: FontWeight.w600, color: colors.ink),
                              ),
                            ),
                          if (progress != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 10),
                              child: _Track(
                                done: progress.done,
                                of: progress.of,
                                // The line above already says "6 of 16 done": the track then reads nothing more.
                                speak: line == null || HomeModel.displayTitle(line) != HomeCopy.progressDone(progress.done, progress.of),
                              ),
                            ),
                          if (sub != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(sub, key: const ValueKey('lh-offer-sub'), style: type.body.copyWith(fontSize: 14.5, height: 1.4, fontWeight: FontWeight.w500, color: colors.ink2)),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: MmSpace.s12),
                    Padding(
                      padding: EdgeInsets.only(top: hasTrack ? 4 : 10),
                      child: const ExcludeSemantics(
                        child: SizedBox(height: 60, child: MobiCharacter(size: 60, shadow: false, seed: 31, watchTaps: false)),
                      ),
                    ),
                  ],
                ),
                if (showKey || showQuiet)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (showKey) KeyButton(key: const ValueKey('lh-offer-key'), label: key.label, minHeight: 56, onPressed: () => onOpen(key)),
                        if (showQuiet) ...[
                          if (showKey) const SizedBox(height: 4),
                          Center(child: HomeTextKey(key: const ValueKey('lh-offer-quiet'), label: quiet.label, onTap: () => onOpen(quiet))),
                        ],
                      ],
                    ),
                  ),
                if (or.isNotEmpty)
                  Padding(
                    padding: EdgeInsets.only(top: showKey || showQuiet ? 14 : 10),
                    child: Semantics(
                      container: true,
                      label: HomeCopy.orGroup,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (var i = 0; i < or.length; i++)
                            DecoratedBox(
                              // One hairline between the key and the rows, one between the rows; none under the last (the hero's edge closes it).
                              decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
                              child: _OrRow(key: ValueKey('lh-or-${or[i].kind ?? i}'), option: or[i], onTap: () => onOpen(or[i])),
                            ),
                        ],
                      ),
                    ),
                  )
                else
                  const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One quiet row under the offer: 56 dp at least, the desk object of what it opens (36 dp, LK60, the web's Or rows), the
/// label (15 w650) over its line (13.5, one line), a chevron. A kind the set has no object for keeps the words alone.
class _OrRow extends StatelessWidget {
  const _OrRow({super.key, required this.option, required this.onTap});

  final LearnOption option;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final line = option.line;
    final icon = RoadmapOffer.orIcon(option.kind);
    return MmPressable(
      semanticsLabel: [option.label, ?line].join('. '),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.985,
      highlight: true,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s2, vertical: MmSpace.s8),
          child: Row(
            children: [
              if (icon != null) ...[BrandIcon(icon, size: 36), const SizedBox(width: MmSpace.s12)],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(option.label, style: type.body.copyWith(fontSize: 15, height: 1.3, fontWeight: FontWeight.w600, color: colors.ink)),
                    if (line != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        HomeModel.displayTitle(line),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: type.body.copyWith(fontSize: 13, height: 1.35, fontWeight: FontWeight.w500, color: colors.ink3),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

/// The pick-up's thin track: only steps that are done (the real "6 of 16"), filled once per visit (420 ms).
class _Track extends StatelessWidget {
  const _Track({required this.done, required this.of, this.speak = true});

  final int done;
  final int of;

  /// Whether the track says "6 of 16 done" to a screen reader (not when the words are already on the screen).
  final bool speak;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final share = of <= 0 ? 0.0 : (done / of).clamp(0.0, 1.0);
    final play = HomeEntrance.playingIn(context);
    return Semantics(
      label: speak ? HomeCopy.progressDone(done, of) : null,
      child: ExcludeSemantics(
        child: Align(
          alignment: Alignment.centerLeft,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: SizedBox(
              height: 6,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ColoredBox(color: colors.line),
                    TweenAnimationBuilder<double>(
                      tween: Tween<double>(begin: play ? 0 : share, end: share),
                      duration: play ? const Duration(milliseconds: 420) : Duration.zero,
                      curve: Motion.emphasized,
                      builder: (context, v, _) => Align(
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(widthFactor: v, heightFactor: 1, child: ColoredBox(color: colors.accentText)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The offer before the data, at its final height (the title, one line, the key), so nothing moves when it lands.
class RoadmapOfferSkeleton extends StatelessWidget {
  const RoadmapOfferSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(top: 2, bottom: 20),
      child: MmSurface.hero(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: 0.78, child: Skeleton(height: 34, radius: 8)),
            SizedBox(height: 12),
            FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: 0.6, child: Skeleton(height: 18, radius: 8)),
            SizedBox(height: 32),
            Skeleton(height: 56, radius: 16),
          ],
        ),
      ),
    );
  }
}
