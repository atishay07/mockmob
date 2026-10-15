import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../insights/widgets/entry_points.dart' show EntryRow;
import 'revise_copy.dart';
import 'revise_data.dart';

/// Review's way into Revise (Mistake Lab v4 slice 4): "4 questions to revise today" with the
/// server's summary under it ("4 due today. 7 cards, 2 recalled twice."). Absent until the read
/// arrives, and absent for good when the server says Revise is not available, the read fails, or
/// the student has no card yet, so nothing points at a dead page and the tab does not jump (the
/// row opens into place).
class ReviseEntry extends ConsumerWidget {
  const ReviseEntry({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final read = ref.watch(reviseEntryProvider).value;
    final show = read != null && !read.isUnavailable && !read.isEmpty;
    return MmSizeEase(
      duration: Motion.of(context, Motion.card),
      curve: Motion.out,
      alignment: Alignment.topCenter,
      child: !show
          ? const SizedBox(width: double.infinity)
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Divider(height: 1, color: context.mmColors.line),
                EntryRow(
                  icon: LucideIcons.rotateCcw,
                  title: read.head ?? ReviseCopy.entryTitle,
                  note: read.summary ?? ReviseCopy.entryNote,
                  onTap: () => context.push(AppRoutes.reviewRevise),
                ),
              ],
            ),
    );
  }
}
