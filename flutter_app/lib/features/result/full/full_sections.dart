import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/domain/domain.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/result_providers.dart';
import '../model/answer_items.dart';
import '../model/recap_model.dart';
import '../result_nav.dart';
import '../widgets/breakdown_section.dart';
import 'answer_row.dart';

/// Held, keys unavailable and corrected keys: said plainly, never a silent rewrite.
List<Widget> annotations(BuildContext context, RecapModel m, RecapData data, {required VoidCallback onRetry}) {
  final corrected = data.detail?.answerReviews.values.where((r) => r.isCorrected).length ?? 0;
  return [
    if (m.keysUnavailable) ...[
      const SizedBox(height: MmSpace.s20),
      InlineBanner(message: ResultCopy.keysUnavailable, tone: BannerTone.warning, actionLabel: ResultCopy.tryAgain, onAction: onRetry),
    ],
    if (data.detail == null && data.error != null && !data.loading) ...[
      const SizedBox(height: MmSpace.s20),
      InlineBanner(message: ResultCopy.loadFailed, tone: BannerTone.error, actionLabel: ResultCopy.tryAgain, onAction: onRetry),
    ],
    if (corrected > 0) ...[
      const SizedBox(height: MmSpace.s20),
      InlineBanner(message: ResultCopy.corrected(corrected), tone: BannerTone.info),
    ],
  ];
}

/// Where the marks went: the same flow as recap card 2, at rest.
Widget whereSection(BuildContext context, RecapModel m) => MmSection(
  title: ResultCopy.sectionWhere,
  child: BreakdownSection(breakdown: m.breakdown, flow: true),
);

/// The first thing to fix, from the observed chapter breakdown, with the repair key. Null when
/// there is nothing to fix.
Widget? firstFixSection(BuildContext context, RecapModel m) {
  final leader = m.chapters.leader;
  final colors = context.mmColors;
  final type = context.mmType;
  if (leader == null && m.candidates.isEmpty) return null;
  return MmSection(
    title: ResultCopy.sectionFirstFix,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (leader != null) ...[
          Text(leader.chapter, style: type.cardTitle),
          const SizedBox(height: MmSpace.s4),
          Text(
            leader.wrong == 0
                ? ResultCopy.blanksEvidence(leader.unattempted, leader.questions)
                : '${ResultCopy.costMost} ${ResultCopy.chapterCounts(leader.questions, leader.correct, leader.wrong, leader.unattempted)}',
            style: type.body.copyWith(color: colors.ink2),
          ),
        ] else
          Text(ResultCopy.wrongByNumber(m.chapters.wrongNumbers.length), style: type.body.copyWith(color: colors.ink2)),
        if (m.candidates.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s16),
          KeyButton(
            label: '${ResultCopy.repairN(m.tonightCount)}, about ${repairMinutes(m.tonightCount)} minutes',
            onPressed: () => context.go(ResultNav.repair(m)),
          ),
        ],
      ],
    ),
  );
}

/// Every answer, grouped: wrong, being checked, not attempted (folded) and correct.
Widget answersSection(
  BuildContext context, {
  required AnswerGroups groups,
  required bool keysOff,
  required bool Function(String) isOpen,
  required GlobalKey Function(String) keyFor,
  required ValueChanged<String> onToggle,
  required RecapModel model,
  bool blankOpen = false,
  VoidCallback? onToggleBlank,
}) {
  final colors = context.mmColors;
  List<Widget> group(String title, List<AnswerItem> items, {bool titled = true}) {
    if (items.isEmpty) return const [];
    return [
      if (titled)
        Padding(
          padding: const EdgeInsets.only(top: MmSpace.s20, bottom: MmSpace.s4),
          child: Text(title, style: context.mmType.label.copyWith(color: colors.ink2)),
        ),
      for (var i = 0; i < items.length; i++) ...[
        if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
        KeyedSubtree(
          key: keyFor(items[i].qid),
          child: AnswerRow(
            item: items[i],
            expanded: isOpen(items[i].qid),
            onToggle: () => onToggle(items[i].qid),
            keysOff: keysOff,
            onRepair: items[i].repairable
                ? () => context.go(
                    Uri(path: AppRoutes.reviewRepair(model.attemptId, items[i].qid), queryParameters: const {'count': '1'}).toString(),
                  )
                : null,
          ),
        ),
      ],
    ];
  }

  return MmSection(
    title: ResultCopy.sectionAnswers,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...group(ResultCopy.groupWrong(groups.wrong.length), groups.wrong),
        ...group(ResultCopy.groupHeld(groups.held.length), groups.held),
        // Blanks have nothing to learn from or repair, so they sit folded under one row (a paper can
        // have dozens, each as tall as a real answer). A tile on card 3 opens the row on its question.
        if (groups.blank.isNotEmpty)
          BlankGroup(
            count: groups.blank.length,
            open: blankOpen,
            onToggle: onToggleBlank ?? () {},
            children: group('', groups.blank, titled: false),
          ),
        ...group(ResultCopy.groupCorrect(groups.correct.length), groups.correct),
      ],
    ),
  );
}

/// The "Not attempted" group folded under one row: bubble, count, chevron. Open, it shows every
/// row. Folded by default, so a paper with dozens of blanks does not push the correct answers
/// screens away; the rows inside are not built while it is folded.
class BlankGroup extends StatelessWidget {
  const BlankGroup({super.key, required this.count, required this.open, required this.onToggle, required this.children});

  final int count;
  final bool open;
  final VoidCallback onToggle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: MmSpace.s20),
        MmPressable(
          onTap: onToggle,
          pressedScale: 0.985,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          highlight: true,
          semanticsLabel: ResultCopy.groupBlankToggle(count, open: open),
          selected: open,
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 60),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
              child: Row(
                children: [
                  const Bubble(state: BubbleState.blank, size: 22, animate: false),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: Text(ResultCopy.groupBlank(count), style: type.subhead.copyWith(fontSize: 16))),
                  AnimatedRotation(
                    turns: open ? 0.5 : 0,
                    duration: Motion.of(context, Motion.ui),
                    curve: Motion.out,
                    child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
                  ),
                ],
              ),
            ),
          ),
        ),
        AnimatedSize(
          duration: Motion.of(context, Motion.card),
          curve: Motion.out,
          alignment: Alignment.topCenter,
          child: !open
              ? const SizedBox(width: double.infinity)
              : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Divider(height: 1, thickness: 1, color: colors.line), ...children]),
        ),
      ],
    );
  }
}
