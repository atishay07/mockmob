import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/repositories/attempts_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../insights/ask_mobi.dart' show AskMobiCard;
import '../../insights/widgets/entry_points.dart' show EntryRow;
import '../../learn/data/catalog_repository.dart';
import '../../learn/data/concepts_pick.dart';
import '../../review/data/review_providers.dart' show openRepairsProvider;
import '../copy.dart';

/// The rows a student looks for on Practice, right under the suggestion instead of three screens down (the owner's
/// D5: "no one will be able to see it ever, the placement is really bad"): Your papers while mistakes wait to be
/// repaired (D105, G20: the Review screen lives inside Practice now; it took the Repairs row's place and rule), Learn
/// with the lesson it would open next and why (the owner's D20: Learn has a clear way in, without a new tab), and Ask
/// Mobi. Ask Mobi's card (ASK-MOBI-1019 B, D112) took the slot of the old "Ask Mobi what to practise" row: moved,
/// nothing removed.
///
/// Your papers is on the page for every account, a fresh one too (R3): here while there are open mistakes, where the
/// Repairs row was, and otherwise first in "More ways in" ([YourPapersRow]), so a first-time student's first screen is
/// the subjects, the start and the modes, as in v15.2. Plain rows with hairlines, then Ask Mobi's card.
class PracticeTopRows extends ConsumerWidget {
  const PracticeTopRows({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(learnCatalogProvider.select((s) => s.value));
    // Learn shows while lessons are switched on and published; never a "not available" row.
    final learn = catalog == null || catalog.isDisabled || catalog.units.isEmpty ? null : practicePanel(catalog, ref.watch(learnChapterCostsProvider));
    final line = Divider(height: 1, color: context.mmColors.line);
    final papersHere = YourPapersRow.showsAtTop(ref.watch(openRepairsProvider));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        line,
        if (papersHere) ...[const YourPapersRow(), line],
        if (learn != null) ...[
          EntryRow(
            icon: LucideIcons.bookOpen,
            title: PracticeCopy.learnTitle,
            note: learn.pick.kind == PickKind.practise ? learn.line : PracticeCopy.learnNote(learn.title, learn.pick.reason),
            onTap: () => context.push(AppRoutes.learn),
          ),
          line,
        ],
        // Ask Mobi's card, in the old "Ask Mobi what to practise" row's slot (ASK-MOBI-1019 B).
        const SizedBox(height: MmSpace.s16),
        const AskMobiCard(),
      ],
    );
  }
}

/// Your papers (D105, G20): the row that opens the Review screen inside Practice, with how many papers are kept and how
/// many mistakes are open across the account (the same count Today's tile and the bar's Practice badge print).
class YourPapersRow extends ConsumerWidget {
  const YourPapersRow({super.key});

  /// Whether the row sits with the top rows (open mistakes, the Repairs row's rule) or first in "More ways in". An
  /// unknown count is never a zero: it reads as none, so the row waits in "More ways in".
  static bool showsAtTop(int? open) => (open ?? 0) > 0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final open = ref.watch(openRepairsProvider) ?? 0;
    final papers = ref.watch(attemptsRepositoryProvider.select((s) => s.value?.length ?? 0));
    return EntryRow(
      key: const ValueKey('practice-your-papers'),
      icon: LucideIcons.notebookText,
      title: PracticeCopy.papersTitle,
      note: PracticeCopy.papersNote(papers: papers, open: open),
      // Inside Practice: pushed in this tab's own stack, so Back returns here.
      onTap: () => context.push(AppRoutes.papers),
    );
  }
}
