import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../insights/insights_routes.dart' show EntryRow, StreamEntry;
import '../copy.dart';
import 'mode_list.dart' show SectionHeading;

/// Under "Choose your own": the untimed question stream in the chosen subject, and the CUET
/// tools (eligibility, cutoffs, combinations). Two plain rows, no art, no counts invented.
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
        StreamEntry(subject: subject),
        Divider(height: 1, color: context.mmColors.line),
        EntryRow(
          icon: LucideIcons.compass,
          title: PracticeCopy.toolsTitle,
          note: PracticeCopy.toolsNote,
          onTap: () => context.push(AppRoutes.tools),
        ),
      ],
    );
  }
}
