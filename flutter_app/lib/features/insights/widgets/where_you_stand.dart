import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/ask_doors.dart' show DoorPrice;
import '../data/mobi_models.dart';
import 'ask_doors.dart' show AskPriceTag;

/// "Where you stand" (MOBI-CONTRACT 1; ASK-MOBI-VALUE 2.4 and 4.3): the lead of the record door. The student's own
/// practice as a range of marks, set against the 2026 Round 1 closing marks of the first of their colleges, with the
/// gap in marks and the chapters that close it fastest (each a key into that chapter's practice). Arithmetic on their
/// own practice, said as a range and never as a prediction. Free: no model is called.
///
/// Every state says only what is true: a partial range is out of the papers it covers and is not compared with
/// colleges; a thin record says how many more questions each subject needs; no colleges offers the Colleges page.
class WhereYouStand extends StatelessWidget {
  const WhereYouStand({super.key, required this.standing, required this.onPractise, required this.onColleges, required this.onRetry});

  final AsyncValue<MobiStanding> standing;

  /// Opens chapter practice for a web path (`/dashboard?mode=chapter&...`).
  final ValueChanged<String> onPractise;
  final VoidCallback onColleges;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = standing.value;
    const radius = BorderRadius.all(Radius.circular(18));

    final List<Widget> body;
    if (s == null) {
      final failed = standing.hasError && !standing.isLoading;
      body = [
        Text(failed ? StandCopy.failed : StandCopy.working, style: type.small.copyWith(color: colors.ink2)),
        if (failed) ...[
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(label: StandCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: onRetry),
        ],
      ];
    } else {
      body = switch (s.status) {
        StandingStatus.ready || StandingStatus.partial => _range(context, s),
        StandingStatus.thin => _thin(context, s),
        StandingStatus.empty => [Text(StandCopy.empty, style: type.small.copyWith(color: colors.ink2))],
      };
    }

    return LitEdge(
      borderRadius: radius,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.sunken,
          shape: RoundedSuperellipseBorder(borderRadius: radius, side: BorderSide(color: colors.lineStrong)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s16, 14, MmSpace.s16, MmSpace.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Semantics(header: true, child: Text(StandCopy.title, style: type.cardTitle.copyWith(letterSpacing: -0.1)))),
                  const SizedBox(width: MmSpace.s8),
                  const AskPriceTag(DoorPrice.free),
                ],
              ),
              const SizedBox(height: MmSpace.s8),
              ...body,
              if (s != null && s.status != StandingStatus.empty) ...[
                const SizedBox(height: MmSpace.s12),
                Text(s.note, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _range(BuildContext context, MobiStanding s) {
    final colors = context.mmColors;
    final type = context.mmType;
    final band = s.band!;
    final ready = s.status == StandingStatus.ready;
    final low = marks(band.low), high = marks(band.high), max = marks(band.max);
    final first = ready ? s.first : null;
    final papers = [for (final p in band.papers) p.name];
    return [
      Semantics(
        label: StandCopy.rangeSentence(low, high, max),
        excludeSemantics: true,
        child: Wrap(
          crossAxisAlignment: WrapCrossAlignment.end,
          spacing: MmSpace.s8,
          children: [
            Text(
              '$low to $high',
              style: type.figure.copyWith(fontSize: 46, height: 44 / 46, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Text(StandCopy.ofMax(max), style: type.small.copyWith(color: colors.ink2, fontSize: 15)),
            ),
          ],
        ),
      ),
      const SizedBox(height: MmSpace.s4),
      Text(
        ready ? StandCopy.fromFour : StandCopy.fromPapers(papers, band.count),
        style: type.small.copyWith(color: colors.ink2, fontSize: 14, height: 19 / 14),
      ),
      const SizedBox(height: MmSpace.s12),
      RangeBar(low: band.low, high: band.high, max: band.max, cutoff: first?.cutoff),
      const SizedBox(height: MmSpace.s12),
      if (!ready)
        Text(StandCopy.partialNext(s.needed), style: type.body.copyWith(fontSize: 15, height: 21 / 15))
      else if (first != null && first.cutoff != null)
        Text(StandCopy.against(first), style: type.body.copyWith(fontSize: 15, height: 21 / 15))
      else if (!s.hasColleges) ...[
        Text(StandCopy.noColleges, style: type.body.copyWith(fontSize: 15, height: 21 / 15)),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(label: StandCopy.addColleges, expanded: false, minHeight: MmTarget.min, onPressed: onColleges),
      ] else
        Text(StandCopy.noCutoffs, style: type.body.copyWith(fontSize: 15, height: 21 / 15)),
      if (s.closeFastest.isNotEmpty) ...[
        const SizedBox(height: MmSpace.s16),
        Text(
          first != null && (first.gap ?? 0) > 0 ? StandCopy.closeFastest : StandCopy.mostOpen,
          style: type.label.copyWith(color: colors.ink2),
        ),
        for (final c in s.closeFastest) ...[
          const SizedBox(height: MmSpace.s8),
          _ChapterKey(chapter: c, onTap: () => onPractise(s.practiceHref(c))),
        ],
      ],
    ];
  }

  List<Widget> _thin(BuildContext context, MobiStanding s) {
    final colors = context.mmColors;
    final type = context.mmType;
    return [
      Text(StandCopy.thinLead(s.minSample), style: type.body.copyWith(fontSize: 15, height: 21 / 15)),
      if (s.thin.isNotEmpty) ...[
        const SizedBox(height: MmSpace.s8),
        for (final t in s.thin)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s4),
            child: Row(
              children: [
                Expanded(child: Text(t.name, style: type.labelLarge)),
                Text(StandCopy.needMore(t.needed), style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
              ],
            ),
          ),
      ],
    ];
  }

  /// Whole marks: a range from practice is never shown to a decimal it cannot support.
  static int marks(double v) => v.round();
}

/// The range on the paper's whole scale (0 to its maximum), with the first college's closing marks as a tick. The
/// tick is labelled in words, never carried by colour alone.
class RangeBar extends StatelessWidget {
  const RangeBar({super.key, required this.low, required this.high, required this.max, this.cutoff});

  final double low;
  final double high;
  final double max;
  final double? cutoff;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final cut = cutoff;
    return ExcludeSemantics(
      child: LayoutBuilder(
        builder: (context, box) {
          final w = box.maxWidth;
          double x(double v) => (v / max).clamp(0.0, 1.0) * w;
          final bandLeft = x(low);
          final bandWidth = (x(high) - bandLeft).clamp(6.0, w);
          final cutX = cut == null ? null : x(cut);
          final cutLabel = cut == null ? null : StandCopy.cutTick(WhereYouStand.marks(cut));
          return SizedBox(
            height: cut == null ? 22 : 40,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: 0,
                  right: 0,
                  top: 6,
                  height: 10,
                  child: DecoratedBox(decoration: BoxDecoration(color: colors.line, borderRadius: BorderRadius.circular(5))),
                ),
                Positioned(
                  left: bandLeft,
                  width: bandWidth,
                  top: 6,
                  height: 10,
                  child: DecoratedBox(decoration: BoxDecoration(color: colors.ink, borderRadius: BorderRadius.circular(5))),
                ),
                if (cutX != null) ...[
                  Positioned(
                    left: cutX - 1,
                    top: 0,
                    width: 2,
                    height: 22,
                    child: DecoratedBox(decoration: BoxDecoration(color: colors.voltEdge, borderRadius: BorderRadius.circular(1))),
                  ),
                  Positioned(
                    top: 24,
                    left: (cutX - 60).clamp(0.0, (w - 120).clamp(0.0, w)),
                    width: 120,
                    child: Text(
                      cutLabel!,
                      textAlign: cutX < 60 ? TextAlign.left : (cutX > w - 60 ? TextAlign.right : TextAlign.center),
                      style: type.caption.copyWith(color: colors.ink2, fontSize: 12, fontFeatures: const [FontFeature.tabularFigures()]),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

/// A chapter that closes the gap: its name, its paper and its open marks, and a tap into its practice.
class _ChapterKey extends ConsumerWidget {
  const _ChapterKey({required this.chapter, required this.onTap});

  final CloseChapter chapter;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    const radius = BorderRadius.all(Radius.circular(14));
    final fill = Color.alphaBlend(colors.litTile, colors.raised);
    return MmPressable(
      semanticsLabel: StandCopy.chapterSpoken(chapter),
      focusRadius: radius,
      pressedScale: 0.98,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? Color.alphaBlend(colors.litTile, fill) : fill,
          shape: RoundedSuperellipseBorder(borderRadius: radius, side: BorderSide(color: colors.line)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(chapter.chapter, style: type.labelLarge),
                      const SizedBox(height: MmSpace.s2),
                      Text(StandCopy.chapterLine(chapter), style: type.caption.copyWith(color: colors.ink3)),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Text(StandCopy.practise, style: type.label.copyWith(fontSize: 13, color: colors.accentText)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The words of Where you stand, in the owner's voice: plain full sentences, no exclamation marks, no arrows.
abstract final class StandCopy {
  static const title = 'Where you stand';
  static const working = 'Mobi is working out where you stand.';
  static const failed = 'Mobi could not work out where you stand just now.';
  static const tryAgain = 'Try again';
  static const empty = 'Finish a practice paper and Mobi shows where your marks put you.';

  static String rangeSentence(int low, int high, int max) => 'Your practice puts you at $low to $high of $max.';
  static String ofMax(int max) => 'of $max';
  static const fromFour = 'Your practice puts you here, across one language and three domain papers.';

  /// "From your Accountancy paper." / "From your Accountancy and Economics papers."
  static String fromPapers(List<String> names, int count) {
    if (names.isEmpty) return count == 1 ? 'From the one paper you have practised enough.' : 'From the $count papers you have practised enough.';
    final joined = names.length == 1 ? names.single : '${names.sublist(0, names.length - 1).join(', ')} and ${names.last}';
    return 'From your $joined ${names.length == 1 ? 'paper' : 'papers'}, out of ${names.length * 250}.';
  }

  static String partialNext(List<String>? needed) => needed == null || needed.isEmpty
      ? 'Once all four of your papers have enough practice, Mobi sets your total against your colleges.'
      : 'Practise ${_and(needed)} too, and Mobi sets your total of 1000 against your colleges.';

  static String _and(List<String> n) => n.length == 1 ? n.single : '${n.sublist(0, n.length - 1).join(', ')} and ${n.last}';

  /// The first college, its closing marks and the gap at the middle of the range.
  static String against(StandingCollege c) {
    final name = c.programme == null ? c.college : '${c.college}, ${c.programme}';
    final cut = WhereYouStand.marks(c.cutoff!);
    final head = '$name closed at $cut for ${c.category} in 2026 Round 1.';
    final gap = c.gap == null ? null : WhereYouStand.marks(c.gap!.abs());
    return switch (c.position) {
      CollegePosition.below when gap != null && gap > 0 => '$head You are $gap ${gap == 1 ? 'mark' : 'marks'} short at the middle of your range.',
      CollegePosition.below => '$head Your range sits below it.',
      CollegePosition.within => '$head That is inside your range, so every mark you add counts.',
      CollegePosition.above => '$head Your whole range is above it. Keep it there.',
      CollegePosition.none => head,
    };
  }

  static const noColleges = 'Add your colleges and Mobi sets this range against their 2026 Round 1 closing marks.';
  static const addColleges = 'Add your colleges';
  static const noCutoffs = 'None of your colleges has a 2026 Round 1 closing mark for your category yet.';
  static String cutTick(int cut) => 'Closed at $cut';

  static const closeFastest = 'These chapters close it fastest';
  static const mostOpen = 'Where your marks are most open';
  static const practise = 'Practise';
  static String chapterLine(CloseChapter c) => '${c.subjectName}. ${c.marks} ${c.marks == 1 ? 'mark' : 'marks'} open here.';
  static String chapterSpoken(CloseChapter c) => 'Practise ${c.chapter}, ${c.subjectName}. ${c.marks} marks open here.';

  static String thinLead(int min) => 'Mobi places you once a paper has $min answered questions. Here is what each subject still needs.';
  static String needMore(int n) => '$n more ${n == 1 ? 'question' : 'questions'}';
}
