// Two clear ways to the student's colleges (19 Oct PM, owner D126 and his H9: "where is that college section now? I am
// unable to find it in the app"). A: a "Your colleges" card at the top of You, with the colleges that need the most
// marks and their real 2026 Round 1 closing marks (D103, D104), "See all N" and "Admission Compass". B: a "Your
// colleges" strip right under Today's greeting that opens the full list. Both read one list, the same one Today's own
// colleges block, Colleges and Compass read, so their numbers always agree. With no colleges chosen yet, both say so
// honestly and invite the student to choose them; neither is ever an empty card.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/hybrid/hybrid.dart' show HybridCompass;
import '../../../core/copy/sentences.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/data/du_catalog.dart';
import '../../today/copy.dart' show TodayCopy;
import '../../today/data/today_profile.dart';
import '../data/my_colleges_actions.dart';
import 'my_colleges_copy.dart';
import 'my_colleges_sheet.dart' show showMyCollegesSheet;

/// Where the student's list stands, for the two ways in.
enum YourCollegesStatus { loading, failed, none, some }

/// The student's colleges, the hardest to get into first, each with its Round 1 closing marks when one is published for
/// the student's category (never estimated).
class YourColleges {
  const YourColleges({required this.status, this.picks = const [], this.category = DuCatalog.defaultCategory});

  final YourCollegesStatus status;
  final List<LadderPick> picks;
  final String category;

  /// How many the card and the strip name: the three hardest (D104), or fewer when fewer are chosen.
  static const int shown = 3;

  List<LadderPick> get top => picks.take(shown).toList();
}

/// One read for You's card and Today's strip: Today's own ladder (My colleges, or the setup's colleges while the list is
/// not known), so the three agree.
final yourCollegesProvider = Provider<YourColleges>((ref) {
  final profile = ref.watch(todayProfileProvider);
  final picks = hardestFirst(profile?.ladder ?? const []);
  final category = profile?.category ?? DuCatalog.defaultCategory;
  if (picks.isNotEmpty) return YourColleges(status: YourCollegesStatus.some, picks: picks, category: category);
  final status = switch (ref.watch(myCollegesProvider).status) {
    MyCollegesStatus.loading => YourCollegesStatus.loading,
    MyCollegesStatus.failed => YourCollegesStatus.failed,
    _ => YourCollegesStatus.none,
  };
  return YourColleges(status: status, category: category);
});

/// The name DU's list prints for short ("SRCC"), or the college's own name.
String shortCollegeName(LadderPick pick) {
  final course = DuCatalog.course(pick.programmeId);
  final mine = course?.offeringAt(pick.college)?.short;
  if (mine != null && mine.isNotEmpty) return mine;
  for (final c in DuCatalog.all) {
    final short = c.offeringAt(pick.college)?.short;
    if (short != null && short.isNotEmpty) return short;
  }
  return pick.college;
}

String _score(num score) => score == score.roundToDouble() ? '${score.round()}' : score.toStringAsFixed(1);

/// Every line the two ways in say (R6: whole sentences, in his voice).
abstract final class CollegesDoorCopy {
  static const String title = 'Your colleges';
  static const String chooseTitle = 'Choose your colleges';
  static const String chooseRest = 'see 2026 cutoffs';
  static const String chooseKey = 'Choose colleges';
  static const String chooseCardLine = 'Pick the colleges you want and see the lowest score each one took in 2026.';
  static const String failedRest = 'open your list';
  static const String noFigureRest = 'see each 2026 cutoff';
  static const String failedCardLine = 'Your colleges did not load. Open the list to try again.';
  static const String compass = 'Admission Compass';
  static const String openList = 'Open the list';
  static String seeAll(int n) => 'See all $n';
  static String seeAllSemantics(int n) => 'See all $n of your colleges';

  /// Today's strip, longest first: the strip shows the first that fits on one line. Each one is true on its own: the
  /// figure is the lowest score that got in at Round 1 in 2026, so it is said as what the college needed.
  static List<StripLine> stripLines(YourColleges c) {
    switch (c.status) {
      case YourCollegesStatus.none:
        return const [StripLine(chooseTitle, ' · $chooseRest'), StripLine(chooseTitle), StripLine(chooseKey)];
      case YourCollegesStatus.failed:
        return const [StripLine(title, ' · $failedRest'), StripLine(title)];
      case YourCollegesStatus.loading:
        return const [StripLine(title)];
      case YourCollegesStatus.some:
        final n = c.picks.length;
        final first = c.picks.first;
        final needed = first.closingScore == null ? null : '${shortCollegeName(first)} needed ${_score(first.closingScore!)}';
        final mine = n == 1 ? 'Your college' : 'Your $n colleges';
        final short = n == 1 ? 'Your college' : title;
        if (needed == null) return [StripLine(mine, ' · $noFigureRest'), StripLine(mine), StripLine(short)];
        return [
          StripLine(mine, ' · $needed in 2026'),
          StripLine(mine, ' · $needed'),
          StripLine(short, ' · $needed'),
          StripLine(mine),
          StripLine(short),
        ];
    }
  }

  /// The strip's whole sentence for a screen reader, whatever its line had room for.
  static String stripSemantics(YourColleges c) => switch (c.status) {
    YourCollegesStatus.none => '$chooseTitle. See the lowest score each college took in 2026.',
    YourCollegesStatus.failed => '$title. Your list did not load. Open it to try again.',
    YourCollegesStatus.loading => title,
    YourCollegesStatus.some => '$title. ${stripSentence(c)}',
  };

  /// How many, and the one that needs the most marks with its figure, as a whole sentence.
  static String stripSentence(YourColleges c) {
    final first = c.picks.first;
    final name = shortCollegeName(first);
    final figure = first.closingScore;
    if (c.picks.length == 1) {
      return figure == null ? 'You picked $name. Open the list to see its 2026 cutoff.' : 'You picked $name. It needed ${_score(figure)} in 2026.';
    }
    return figure == null
        ? 'You picked ${c.picks.length}. Open the list to see each 2026 cutoff.'
        : 'You picked ${c.picks.length}. The hardest, $name, needed ${_score(figure)} in 2026.';
  }

  /// You's card: how many, for which course, and what each number means.
  static String cardLine(YourColleges c) {
    final courses = {for (final p in c.picks) p.course};
    final n = c.picks.length;
    final colleges = n == 1 ? '1 college' : '$n colleges';
    final what = courses.length == 1 && courses.first.isNotEmpty ? '$colleges for ${courses.first}' : colleges;
    return '${endSentence(what)} Each number is the lowest score that got in at Round 1 in 2026, for the ${TodayCopy.categoryWords(c.category)} category.';
  }

  static String rowSemantics(LadderPick p) =>
      joinSentences(['${p.college}, ${p.course}', p.closingScore == null ? 'No 2026 figure is published for your category' : 'Closed at ${_score(p.closingScore!)} of ${p.outOf ?? DuCatalog.scale}']);
}

void _openList(BuildContext context) => context.push(AppRoutes.colleges);

void _choose(BuildContext context) => showMyCollegesSheet(context, adding: true);

/// B. Today's strip, right under the greeting: ONE line, one tap. It opens the full list (or, with none chosen, the
/// chooser). 48 dp, the app's plain surface, no new motion (it rides Today's own first-paint entrance). Its line never
/// wraps: it says the most it can on one line at the width and text size it has ([CollegesDoorCopy.stripLines]), and a
/// screen reader always hears the whole sentence. One line keeps the move card and the start of "Suggested for you" on
/// Today's first screen (19 Oct PM: the two-line strip pushed the move down by about 90 dp).
class TodayCollegesStrip extends ConsumerWidget {
  const TodayCollegesStrip({super.key});

  /// The strip's height: one line plus its sides, and the tap target's minimum. It holds this from the first frame,
  /// so nothing under it moves when the list lands (up to text 1.6 on a 320 dp phone; see [build]).
  static const double height = 48;

  static const double _side = MmSpace.s16;
  static const double _icon = 20;
  static const double _chevron = 18;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = ref.watch(yourCollegesProvider);
    final none = c.status == YourCollegesStatus.none;
    final lead = type.labelLarge;
    final rest = type.small.copyWith(color: colors.ink2);
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);
    TextSpan span(StripLine l) => TextSpan(children: [TextSpan(text: l.lead, style: lead), if (l.rest != null) TextSpan(text: l.rest, style: rest)]);
    return MmSurface.plain(
      key: const ValueKey('today-colleges-strip'),
      padding: const EdgeInsets.symmetric(horizontal: _side),
      onTap: () => none ? _choose(context) : _openList(context),
      semanticsLabel: CollegesDoorCopy.stripSemantics(c),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: height),
        child: Row(
          children: [
            ExcludeSemantics(child: Icon(none ? LucideIcons.plus : LucideIcons.landmark, size: _icon, color: colors.ink2)),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: LayoutBuilder(
                builder: (context, box) {
                  bool fits(StripLine l, double room) {
                    final painter = TextPainter(text: span(l), textDirection: direction, textScaler: scaler, maxLines: 1)..layout();
                    final ok = painter.width <= room;
                    painter.dispose();
                    return ok;
                  }

                  final options = CollegesDoorCopy.stripLines(c);
                  final fit = options.where((l) => fits(l, box.maxWidth)).firstOrNull;
                  // Only at the very largest text on the narrowest phones does even the shortest line not fit: then it
                  // wraps whole and the strip grows, rather than cutting a word.
                  final line = fit ?? options.last;
                  // While the list is read, a short bar holds the place of the words that will land, when there is room.
                  final loading = c.status == YourCollegesStatus.loading && fits(line, box.maxWidth - 84);
                  return ExcludeSemantics(
                    child: Row(
                      children: [
                        Flexible(
                          child: MmOverlapSwitcher.fade(
                            alignment: Alignment.centerLeft,
                            child: fit == null
                                ? Padding(key: ValueKey('${line.text}:wrap'), padding: const EdgeInsets.symmetric(vertical: MmSpace.s8), child: Text.rich(span(line)))
                                : Text.rich(span(line), key: ValueKey(line.text), maxLines: 1, softWrap: false),
                          ),
                        ),
                        if (loading) ...[const SizedBox(width: MmSpace.s12), const Skeleton.line(width: 72, height: 12)],
                      ],
                    ),
                  );
                },
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            ExcludeSemantics(child: Icon(LucideIcons.chevronRight, size: _chevron, color: colors.ink3)),
          ],
        ),
      ),
    );
  }
}

/// One way to say the strip's line: the lead words ("Your 6 colleges") and, when there is room, the rest
/// (" · SRCC needed 924.3").
class StripLine {
  const StripLine(this.lead, [this.rest]);

  final String lead;
  final String? rest;

  String get text => rest == null ? lead : '$lead$rest';

  @override
  String toString() => text;
}

/// A. You's card, right under the name: the colleges that need the most marks (up to three) with their real Round 1
/// closing marks, then "See all N" and "Admission Compass". With none chosen, an honest invite to choose them, with the
/// Compass still one tap away. Names wrap; they are never cut.
class YouCollegesCard extends ConsumerWidget {
  const YouCollegesCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = ref.watch(yourCollegesProvider);
    final Widget body = switch (c.status) {
      YourCollegesStatus.loading => const Column(
        key: ValueKey('you-colleges-loading'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [SizedBox(height: MmSpace.s8), MmSkeletonRows(rows: 3)],
      ),
      YourCollegesStatus.failed => Text(CollegesDoorCopy.failedCardLine, key: const ValueKey('you-colleges-failed'), style: type.body.copyWith(color: colors.ink2)),
      YourCollegesStatus.none => Text(CollegesDoorCopy.chooseCardLine, key: const ValueKey('you-colleges-none'), style: type.body.copyWith(color: colors.ink2)),
      YourCollegesStatus.some => Column(
        key: const ValueKey('you-colleges-some'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(CollegesDoorCopy.cardLine(c), style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          for (final p in c.top) _Row(pick: p),
        ],
      ),
    };
    final keys = switch (c.status) {
      YourCollegesStatus.none => [
        _CardKey(label: CollegesDoorCopy.chooseKey, onTap: () => _choose(context)),
        _CardKey(label: CollegesDoorCopy.compass, onTap: () => context.push(AppRoutes.toolsCompass)),
      ],
      YourCollegesStatus.some => [
        _CardKey(
          label: c.picks.length > YourColleges.shown ? CollegesDoorCopy.seeAll(c.picks.length) : CollegesDoorCopy.openList,
          semanticsLabel: c.picks.length > YourColleges.shown ? CollegesDoorCopy.seeAllSemantics(c.picks.length) : null,
          onTap: () => _openList(context),
        ),
        _CardKey(label: CollegesDoorCopy.compass, onTap: () => context.push(AppRoutes.toolsCompass)),
      ],
      _ => [
        _CardKey(label: CollegesDoorCopy.openList, onTap: () => _openList(context)),
        _CardKey(label: CollegesDoorCopy.compass, onTap: () => context.push(AppRoutes.toolsCompass)),
      ],
    };
    return MmSurface.plain(
      key: const ValueKey('you-colleges-card'),
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: MmSpace.s4),
                  child: Semantics(
                    header: true,
                    child: Text(c.status == YourCollegesStatus.none ? CollegesDoorCopy.chooseTitle : CollegesDoorCopy.title, style: type.title),
                  ),
                ),
              ),
              // The Compass's own brass object, at rest: the card's one piece of art (no new motion).
              const ExcludeSemantics(child: SizedBox(width: 56, height: 56, child: HybridCompass(height: 56))),
            ],
          ),
          const SizedBox(height: MmSpace.s4),
          MmSizeEase(
            duration: Motion.of(context, Motion.card),
            curve: Motion.out,
            alignment: Alignment.topCenter,
            child: MmOverlapSwitcher.fade(alignment: Alignment.topLeft, child: body),
          ),
          const SizedBox(height: MmSpace.s16),
          // Two keys side by side; at large text they stack, so neither word is cut.
          if (MediaQuery.textScalerOf(context).scale(16) > 16 * 1.25)
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [keys[0], const SizedBox(height: MmSpace.s8), keys[1]])
          else
            Row(children: [Expanded(flex: 10, child: keys[0]), const SizedBox(width: MmSpace.s8), Expanded(flex: 15, child: keys[1])]),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.pick});

  final LadderPick pick;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figure = pick.closingScore;
    return Semantics(
      container: true,
      label: CollegesDoorCopy.rowSemantics(pick),
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: Text(pick.college, style: type.labelLarge)),
              const SizedBox(width: MmSpace.s12),
              if (figure == null)
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 104),
                  child: Text(MyCollegesCopy.noFigure, textAlign: TextAlign.right, style: type.caption.copyWith(color: colors.ink3)),
                )
              else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(_score(figure), style: type.figureCompact.copyWith(fontSize: 24, height: 1)),
                    const SizedBox(width: MmSpace.s4),
                    Text('of ${pick.outOf ?? DuCatalog.scale}', style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A pill key sized for the card: the app's secondary key surface, with room for "Admission Compass" on one line at
/// 360 dp (the shared key's 24 dp sides would wrap it). 48 dp tall, the focus ring, a light tap.
class _CardKey extends StatelessWidget {
  const _CardKey({required this.label, required this.onTap, this.semanticsLabel});

  final String label;
  final VoidCallback onTap;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel ?? label,
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, focused) => Container(
        constraints: const BoxConstraints(minHeight: 48),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
        alignment: Alignment.center,
        decoration: ShapeDecoration(color: colors.raised, shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
        child: Text(label, textAlign: TextAlign.center, style: type.labelLarge),
      ),
    );
  }
}
