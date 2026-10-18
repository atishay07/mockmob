import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/repositories/attempts_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../insights/ask_mobi.dart' show AskMobiPracticeRow;
import '../../insights/widgets/entry_points.dart' show EntryRow;
import '../../learn/data/catalog_repository.dart';
import '../../learn/data/concepts_pick.dart';
import '../../review/data/review_providers.dart' show openRepairsProvider;
import '../copy.dart';

/// The rows a student looks for on Practice, right under the suggestion instead of three screens down (the owner's
/// D5: "no one will be able to see it ever, the placement is really bad"): Your papers (D105, G20: the Review screen
/// lives inside Practice now), with how many papers are kept and how many mistakes are open across the account (the
/// same count Today's tile and the bar's Practice badge print), Learn with the lesson it would open next and why (the
/// owner's D20: Learn has a clear way in, without a new tab), and Ask Mobi what to practise.
///
/// Your papers shows on every account, a fresh one too (R1: it says every paper will be kept there). It took the place
/// of the Repairs row, which opened the same screen, so its line carries the open mistakes. Plain rows with
/// hairlines, no art, no card.
class PracticeTopRows extends ConsumerWidget {
  const PracticeTopRows({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final open = ref.watch(openRepairsProvider) ?? 0;
    final papers = ref.watch(attemptsRepositoryProvider.select((s) => s.value?.length ?? 0));
    final catalog = ref.watch(learnCatalogProvider.select((s) => s.value));
    // Learn shows while lessons are switched on and published; never a "not available" row.
    final learn = catalog == null || catalog.isDisabled || catalog.units.isEmpty ? null : practicePanel(catalog, ref.watch(learnChapterCostsProvider));
    final line = Divider(height: 1, color: context.mmColors.line);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        line,
        EntryRow(
          key: const ValueKey('practice-your-papers'),
          icon: LucideIcons.notebookText,
          title: PracticeCopy.papersTitle,
          note: PracticeCopy.papersNote(papers: papers, open: open),
          // Inside Practice: pushed in this tab's own stack, so Back returns here.
          onTap: () => context.push(AppRoutes.papers),
        ),
        line,
        if (learn != null) ...[
          EntryRow(
            icon: LucideIcons.bookOpen,
            title: PracticeCopy.learnTitle,
            note: learn.pick.kind == PickKind.practise ? learn.line : PracticeCopy.learnNote(learn.title, learn.pick.reason),
            onTap: () => context.push(AppRoutes.learn),
          ),
          line,
        ],
        const AskMobiPracticeRow(),
        line,
      ],
    );
  }
}
