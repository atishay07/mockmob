import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/tonight_pick.dart' show otherChapter;
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../credits/data/credit_figures.dart' show creditFiguresProvider;
import '../../insights/data/subject_names.dart' show canonicalSubjectId;
import '../../pro_nudge/pro_nudge.dart' show ProNudgeRow, ProNudgeSurface;
import '../../result/model/next_move.dart' show NextMoveRules;
import '../copy.dart';
import '../data/review_providers.dart' show subjectName;
import '../model/review_chapters.dart';
import 'chapter_hero.dart';
import 'chapter_mistakes.dart';
import 'more_chapters.dart';
import 'review_layout.dart';

/// Where Practise opens for [row]: the practice setup with the subject and the chapter filled in and 10 questions chosen, so the
/// cost shows before anything starts. A bucket of questions with no chapter ("Other questions") is not a chapter to practise, so
/// it opens a Quick set in its subject instead.
String practisePathFor(ChapterRow row) {
  final subject = canonicalSubjectId(row.subject ?? '');
  final count = '${NextMoveRules.setSize}';
  if (row.name == otherChapter) {
    return Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'count': count, if (subject.isNotEmpty) 'subject': subject}).toString();
  }
  return Uri(
    path: AppRoutes.practiceSetup('chapter'),
    queryParameters: {if (subject.isNotEmpty) 'subject': subject, 'chapter': row.name, 'count': count},
  ).toString();
}

/// The lead of Review: weak chapters (REVIEW-RESULT-1018 4, owner D18: "in the review section, we can integrate the weak
/// chapters"). The sentence over everything says what the papers cost; the open chapter is the hero with its one volt key and
/// its mistakes under it; the other chapters follow as "More chapters", and a tap on one makes it the hero. Exactly one chapter
/// is open at a time, so there is exactly one volt key in the content.
class WeakChaptersLead extends ConsumerStatefulWidget {
  const WeakChaptersLead({super.key, required this.body, required this.onRepair, this.initialOpen});

  final ChaptersBody body;

  /// Opens the repair at a mistake.
  final ValueChanged<RowItem> onRepair;

  /// The chapter that starts open (by id); the costliest otherwise.
  final String? initialOpen;

  @override
  ConsumerState<WeakChaptersLead> createState() => _WeakChaptersLeadState();
}

class _WeakChaptersLeadState extends ConsumerState<WeakChaptersLead> {
  final GlobalKey _hero = GlobalKey(debugLabel: 'review-open-chapter');
  late String? _openId = widget.initialOpen;

  void _open(ChapterRow row) {
    setState(() => _openId = row.id);
    // The chapter becomes the hero at the top: bring it into view so the tap shows its result.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final at = _hero.currentContext;
      if (at == null || !at.mounted) return;
      Scrollable.ensureVisible(at, alignment: 0.02, duration: Motion.of(at, Motion.emphasizedDuration), curve: Motion.emphasized);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final body = widget.body;
    final rows = body.rows;
    var at = rows.indexWhere((r) => r.id == _openId);
    if (at < 0) at = 0;
    final open = rows[at];
    final credits = ref.watch(creditFiguresProvider);
    final practice = credits.stale ? null : credits.practice;
    final inSubject = open.name == otherChapter;
    final practiseLabel = inSubject ? ReviewCopy.practiseInSubject(NextMoveRules.setSize, subjectName(open.subject ?? '')) : ReviewCopy.practiseOnChapter(NextMoveRules.setSize);
    final line = ReviewCopy.practiseLine(
      size: NextMoveRules.setSize,
      cost: NextMoveRules.practiceCost,
      allRepaired: open.open.isEmpty,
      isPro: credits.isPro,
      credits: practice,
    );
    final summary = body.line;
    final lede = type.body.copyWith(fontSize: 15, height: 22 / 15, color: colors.ink2);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // "Your 3 papers lost 220 marks: 30 wrong answers and 8 left blank. 9 are repaired."
        summary.lost > 0
            ? Text.rich(
                TextSpan(
                  style: lede,
                  children: [
                    TextSpan(text: '${summary.who} lost '),
                    TextSpan(text: '${summary.lost} marks', style: lede.copyWith(fontWeight: FontWeight.w600, color: colors.ink)),
                    TextSpan(text: ': ${summary.what}.${summary.fixed}'),
                  ],
                ),
              )
            : Text(summary.text, style: lede),
        const SizedBox(height: ReviewSpace.item + 4),
        KeyedSubtree(
          key: _hero,
          child: MmOverlapSwitcher(
            child: Column(
              key: ValueKey(open.id),
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ChapterHero(
                  row: open,
                  rank: at + 1,
                  practiseLabel: practiseLabel,
                  practiseLine: line,
                  onPractise: () => context.push(practisePathFor(open)),
                ),
                // The one Pro nudge on Review: nothing with PLAY_BILLING off or for a Pro student.
                const ProNudgeRow(surface: ProNudgeSurface.reviewPractise, topGap: MmSpace.s4),
                const SizedBox(height: ReviewSpace.group),
                ChapterMistakes(row: open, onRepair: widget.onRepair),
              ],
            ),
          ),
        ),
        const SizedBox(height: ReviewSpace.section),
        MoreChapters(
          rows: [for (final r in rows) if (r.id != open.id) r],
          total: rows.length,
          across: body.across,
          onOpen: _open,
        ),
      ],
    );
  }
}
