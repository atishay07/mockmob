import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../model/session_analysis.dart';
import '../result_copy.dart';
import 'result_list.dart' show ResultPanel;

/// "What this set shows": the website's observations for one session (changed answers, rushed
/// picks, one weak chapter, blanks), each one fact, its consequence and one thing to do, with
/// "Show me" opening the questions behind it. Nothing appears when the session shows nothing.
class ObservationsPanel extends StatelessWidget {
  const ObservationsPanel({super.key, required this.analysis, required this.onShow});

  final SessionAnalysis analysis;

  /// Opens every one of these question numbers in the list below and scrolls to the first.
  final ValueChanged<List<int>> onShow;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final timed = analysis.dwellMs.values;
    final total = timed.fold(0, (s, v) => s + v);
    final timing = timed.isEmpty ? null : ResultCopy.timingLine(formatDwell(total), formatDwell(total ~/ timed.length));
    final hidden = analysis.telemetry == 'inconsistent' || analysis.telemetry == 'invalid';
    if (analysis.observations.isEmpty && timing == null && !hidden) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: MmSpace.group),
        Padding(
          padding: const EdgeInsets.only(left: MmSpace.s4, bottom: MmSpace.s8),
          child: Semantics(header: true, child: Text(ResultCopy.showsTitle, style: type.title.copyWith(fontSize: 20))),
        ),
        if (timing != null || hidden)
          Padding(
            padding: const EdgeInsets.only(left: MmSpace.s4, bottom: MmSpace.s12),
            child: Text(timing ?? ResultCopy.timingHidden, style: type.small.copyWith(color: colors.ink2)),
          ),
        if (analysis.observations.isNotEmpty)
          ResultPanel(children: [for (final o in analysis.observations) _ObservationRow(o, onShow: onShow)]),
      ],
    );
  }
}

class _ObservationRow extends StatelessWidget {
  const _ObservationRow(this.o, {required this.onShow});

  final Observation o;
  final ValueChanged<List<int>> onShow;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final labelColor = switch (o.tone) {
      ObservationTone.good => colors.goodText,
      ObservationTone.bad => colors.ink2,
      ObservationTone.neutral => colors.ink3,
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s16, MmSpace.s4, MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sentence case, plainly: no tracked capitals.
          Text(o.label, style: type.caption.copyWith(color: labelColor, fontWeight: FontWeight.w600)),
          const SizedBox(height: MmSpace.s4),
          Text(o.headline, style: type.cardTitle.copyWith(fontSize: 17)),
          const SizedBox(height: MmSpace.s4),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '${o.detail} '),
                TextSpan(text: o.tip, style: TextStyle(color: colors.ink)),
              ],
            ),
            style: type.small.copyWith(color: colors.ink2),
          ),
          if (o.questions.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s4),
            Row(
              children: [
                Expanded(child: Text(ResultCopy.questionsLine(o.questions), style: type.caption.copyWith(color: colors.ink3))),
                ShowMePill(onTap: () => onShow(o.questions), semanticsLabel: '${ResultCopy.showMe}: ${ResultCopy.questionsLine(o.questions)}'),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
