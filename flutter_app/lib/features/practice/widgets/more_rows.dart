import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../insights/insights_routes.dart' show EntryRow, StreamEntry;
import '../../review/data/review_providers.dart' show openRepairsProvider;
import '../../review/review_routes.dart' show ReviewAgainRow;
import '../../social/social.dart' show MobEntryPlace, MobEntryRow;
import '../copy.dart';
import 'mode_list.dart' show SectionHeading;
import 'top_rows.dart' show YourPapersRow;

/// "More ways in", under the modes: Your papers while no mistake waits (D105; with open mistakes it sits under the
/// suggestion), Revise or Review again (when there is something to ask), this week's Mob paper (when the student is in
/// a Mob), the untimed question stream in the chosen subject, and the Admission Compass, pushed straight (the `/tools`
/// hub is now a redirect to Colleges, so Back returns here). Plain rows, no art, no counts invented. "Ask Mobi what to
/// practise" is not here: it sits under the suggestion at the top (`PracticeTopRows`, the owner's D5).
class PracticeMoreRows extends StatelessWidget {
  const PracticeMoreRows({super.key, required this.subject});

  final String subject;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeading(title: PracticeCopy.moreHeading),
        const SizedBox(height: MmSpace.s4),
        // Your papers, while no mistake waits (with open mistakes it sits under the suggestion, D105).
        const _PapersHereWhenQuiet(),
        // Review again first (L14): the only row here that is an action on the student's own
        // repaired mistakes. Review owns it; it shows only when there is something to ask.
        const ReviewAgainRow(),
        // This week's Mob paper, for a student in a Mob (nothing at all otherwise).
        const MobEntryRow(place: MobEntryPlace.practice),
        StreamEntry(subject: subject),
        Divider(height: 1, color: context.mmColors.line),
        EntryRow(
          icon: LucideIcons.compass,
          title: PracticeCopy.toolsTitle,
          note: PracticeCopy.toolsNote,
          onTap: () => context.push(AppRoutes.toolsCompass),
        ),
      ],
    );
  }
}

class _PapersHereWhenQuiet extends ConsumerWidget {
  const _PapersHereWhenQuiet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (YourPapersRow.showsAtTop(ref.watch(openRepairsProvider))) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [const YourPapersRow(), Divider(height: 1, color: context.mmColors.line)],
    );
  }
}
