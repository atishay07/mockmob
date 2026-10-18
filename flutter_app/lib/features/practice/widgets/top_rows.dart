import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../insights/ask_mobi.dart' show AskMobiPracticeRow;
import '../../insights/widgets/entry_points.dart' show EntryRow;
import '../../learn/data/catalog_repository.dart';
import '../../learn/data/concepts_pick.dart';
import '../../review/data/review_providers.dart' show openRepairsProvider;
import '../copy.dart';

/// The rows a student looks for on Practice, right under the suggestion instead of three screens down (the owner's
/// D5: "no one will be able to see it ever, the placement is really bad"): Repairs, with how many mistakes are open
/// across the account (the same count Review's header and Today's tile print), Learn with the lesson it would open
/// next and why (the owner's D20: Learn has a clear way in, without a new tab), and Ask Mobi what to practise.
///
/// Repairs shows for any account with an open mistake and for none without one (an unknown count is never a zero, and
/// no row points at nothing). Plain rows with hairlines, no art, no card.
class PracticeTopRows extends ConsumerWidget {
  const PracticeTopRows({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final open = ref.watch(openRepairsProvider) ?? 0;
    final catalog = ref.watch(learnCatalogProvider.select((s) => s.value));
    // Learn shows while lessons are switched on and published; never a "not available" row.
    final learn = catalog == null || catalog.isDisabled || catalog.units.isEmpty ? null : practicePanel(catalog, ref.watch(learnChapterCostsProvider));
    final line = Divider(height: 1, color: context.mmColors.line);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        line,
        if (open > 0) ...[
          EntryRow(
            icon: LucideIcons.wrench,
            title: PracticeCopy.repairsTitle,
            note: PracticeCopy.repairsNote(open),
            onTap: () => context.go(AppRoutes.review),
          ),
          line,
        ],
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
