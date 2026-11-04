import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/brand/brand_icon.dart';
import '../../insights/insights_routes.dart' show EntryRow, StreamEntry;
import '../../learn2/learn2_door.dart' show ChapterFeedsRow;
import '../../review/review_routes.dart' show ReviewAgainRow;
import '../../social/social.dart' show MobEntryPlace, MobEntryRow;
import '../copy.dart';
import 'mode_list.dart' show SectionHeading;

/// "More ways in", at the end of the Practise door: Revise or Review again (when there is something to ask), this week's
/// Mob paper (when the student is in a Mob), Untimed questions in the chosen subject (the old Question stream, renamed in
/// D126), and the Admission Compass, pushed straight (the `/tools` hub is now a redirect to Colleges, so Back returns
/// here). Plain rows, each led by the desk object of what it opens (LK60, the web's branded icons), no counts invented.
/// Your papers is not here any more: it is a door of Practice (D126).
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
        // Review again first (L14): the only row here that is an action on the student's own
        // repaired mistakes. Review owns it; it shows only when there is something to ask.
        const ReviewAgainRow(brand: true),
        // This week's Mob paper, for a student in a Mob (nothing at all otherwise).
        const MobEntryRow(place: MobEntryPlace.practice, brand: true),
        // Learn v2's chapter feeds (APP-1101 decision 4), above the untimed questions; nothing while Learn v2 is off.
        ChapterFeedsRow(subject: subject, divider: true),
        StreamEntry(subject: subject),
        Divider(height: 1, color: context.mmColors.line),
        EntryRow(
          icon: LucideIcons.compass,
          brand: BrandIconName.compass,
          title: PracticeCopy.toolsTitle,
          note: PracticeCopy.toolsNote,
          onTap: () => context.push(AppRoutes.toolsCompass),
        ),
      ],
    );
  }
}
