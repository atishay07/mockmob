import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../insights/widgets/entry_points.dart' show EntryRow;
import '../copy.dart';
import '../data/rules_data.dart';

/// Review's way into the Rule book: "Your rules, 7" once the book has loaded (the server's own
/// label), with the rule in force for the next mock as its quiet line.
class RulesEntry extends ConsumerWidget {
  const RulesEntry({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final book = ref.watch(rulesRepositoryProvider.select((s) => s.value?.book));
    final active = book?.active;
    return EntryRow(
      icon: LucideIcons.scrollText,
      title: book?.countLabel ?? RulesCopy.title,
      note: active == null ? null : RulesCopy.activeNote(active.text),
      onTap: () => context.push(AppRoutes.reviewRules),
    );
  }
}

/// The Lab's Repair step's way into the Rule book, from the result's own read (`lab.rules`).
class LabRulesLink extends StatelessWidget {
  const LabRulesLink({super.key, required this.countLabel, this.activeRule});

  /// "Your rules, 7".
  final String countLabel;

  /// The rule in force for the next mock, when there is one.
  final String? activeRule;

  @override
  Widget build(BuildContext context) => EntryRow(
        icon: LucideIcons.scrollText,
        title: countLabel,
        note: activeRule == null ? null : RulesCopy.activeNote(activeRule!),
        onTap: () => context.push(AppRoutes.reviewRules),
      );
}
