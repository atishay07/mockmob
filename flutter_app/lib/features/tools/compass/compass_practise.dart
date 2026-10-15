import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../practice/data/practice_catalog.dart';
import '../copy.dart';
import '../domain/du_models.dart';
import '../widgets/action_chip.dart';
import '../widgets/tools_card.dart';
import 'compass_controller.dart';

/// The bridge from the target to the work: the ticked subjects MockMob can practise, each
/// opening a quick practice in that subject. Hidden until the subject list has loaded, and for
/// subjects the app cannot practise yet.
class CompassPractise extends ConsumerWidget {
  const CompassPractise({super.key, required this.state});

  final CompassState state;

  /// The aptitude test is `general_test` in the practice registry.
  static String practiceId(DuPick pick) => pick.kind == DuPickKind.gat ? 'general_test' : pick.id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final supported = {for (final s in ref.watch(practiceSubjectsProvider).value ?? const []) if (s.isSupported) s.id};
    final picks = [for (final p in state.selection.picks) if (supported.contains(practiceId(p))) p];
    if (picks.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const ToolsHeading(ToolsCopy.practiseHeading, note: ToolsCopy.practiseNote),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: Wrap(
            spacing: MmSpace.s8,
            children: [
              for (final p in picks)
                ToolsActionChip(
                  label: p.name(state.catalog, short: true),
                  icon: LucideIcons.play,
                  // Pushed over Compass, so Back returns to the list the student was working through.
                  onTap: () => context.push(
                    Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'subject': practiceId(p)}).toString(),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
