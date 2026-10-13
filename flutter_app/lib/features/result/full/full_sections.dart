import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/domain.dart';
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

Widget _sectionTitle(BuildContext context, String text) => Padding(
  padding: const EdgeInsets.only(top: MmSpace.group, bottom: MmSpace.s12),
  child: Semantics(header: true, child: Text(text, style: context.mmType.title)),
);

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

List<Widget> whereSection(BuildContext context, RecapModel m) => [
  _sectionTitle(context, ResultCopy.sectionWhere),
  BreakdownSection(breakdown: m.breakdown),
];

/// The first thing to fix, from the observed chapter breakdown, with the repair key.
List<Widget> firstFixSection(BuildContext context, RecapModel m) {
  final leader = m.chapters.leader;
  final colors = context.mmColors;
  final type = context.mmType;
  if (leader == null && m.candidates.isEmpty) return const [];
  return [
    _sectionTitle(context, ResultCopy.sectionFirstFix),
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
        label: '${ResultCopy.repairN(m.candidates.length)}, about ${repairMinutes(m.candidates.length)} minutes',
        onPressed: () => context.go(ResultNav.repair(m)),
      ),
    ],
  ];
}

List<Widget> answersSection(
  BuildContext context, {
  required AnswerGroups groups,
  required bool keysOff,
  required bool Function(String) isOpen,
  required GlobalKey Function(String) keyFor,
  required ValueChanged<String> onToggle,
  required RecapModel model,
}) {
  final colors = context.mmColors;
  List<Widget> group(String title, List<AnswerItem> items) {
    if (items.isEmpty) return const [];
    return [
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

  return [
    _sectionTitle(context, ResultCopy.sectionAnswers),
    ...group(ResultCopy.groupWrong(groups.wrong.length), groups.wrong),
    ...group(ResultCopy.groupHeld(groups.held.length), groups.held),
    ...group(ResultCopy.groupBlank(groups.blank.length), groups.blank),
    ...group(ResultCopy.groupCorrect(groups.correct.length), groups.correct),
  ];
}
