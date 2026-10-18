import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../insights/ask_mobi.dart' show AskMobiPracticeRow;
import '../../insights/widgets/entry_points.dart' show EntryRow;
import '../../review/data/review_providers.dart' show openRepairsProvider;
import '../copy.dart';

/// The two rows a student looks for on Practice, right under the suggestion instead of three screens down (the owner's
/// D5: "no one will be able to see it ever, the placement is really bad"): Repairs, with how many mistakes are open
/// across the account (the same count Review's header and Today's tile print), and Ask Mobi what to practise.
///
/// Repairs shows for any account with an open mistake and for none without one (an unknown count is never a zero, and
/// no row points at nothing). Plain rows with hairlines, no art, no card.
class PracticeTopRows extends ConsumerWidget {
  const PracticeTopRows({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final open = ref.watch(openRepairsProvider) ?? 0;
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
        const AskMobiPracticeRow(),
        line,
      ],
    );
  }
}
