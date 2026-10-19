// The smart layer on Today (SMART-LAYER-1019PM 2.5), in places that already exist: the line under
// the length panel's title (why the plan is this long, and today's progress toward the goal) and
// the Why sheet's learned lines. Each learned line carries "Not quite right?", which forgets that
// fact and lets the student say what is true. Nothing here invents a pattern: a line shows only
// when its rule held on the student's own log.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart' show tonightOrToday;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy_pattern.dart';
import '../data/study_log_store.dart';
import '../data/today_providers.dart' show todayInputsProvider;
import '../logic/move_builder.dart' show lengthAdviceFor;
import '../logic/study_pattern.dart';
import '../logic/today_model.dart' show DurationChoice;

/// The lines the length panel shows for [durations] (the plan picked [selected] by default when the
/// student has not chosen): why, then today's progress. Empty when nothing true can be said.
List<PatternLine> lengthPanelLines(StudyPattern p, LengthAdvice advice, {required List<DurationChoice> durations, required int selected, required String when}) {
  final chips = [for (final d in durations) if (!d.fullMock) d.minutes];
  final why = advice.fullMockLead && p.goalMinutes != null && durations.any((d) => d.fullMock)
      ? PatternLine(PatternCopy.fullMockLead(p.goalMinutes!, when))
      : lengthLine(p, advice, chip: advice.pick(chips) ?? selected, when: when);
  return [?why, ?goalLine(p)];
}

/// Under the length panel's title. [durations] and [selected] are the panel's own.
class LengthInsight extends ConsumerWidget {
  const LengthInsight({super.key, required this.durations, required this.selected});

  final List<DurationChoice> durations;
  final int selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inputs = ref.watch(todayInputsProvider);
    final p = inputs.pattern;
    if (p == null || inputs.attempts == null || inputs.attempts!.isEmpty) return const SizedBox.shrink();
    final lines = lengthPanelLines(p, lengthAdviceFor(inputs), durations: durations, selected: selected, when: tonightOrToday(inputs.clock()));
    if (lines.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s12),
      child: PatternLines(lines: lines),
    );
  }
}

/// Learned lines, each with "Not quite right?" when it can be corrected (one link for the block,
/// covering every fact in it).
class PatternLines extends ConsumerWidget {
  const PatternLines({super.key, required this.lines});

  final List<PatternLine> lines;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final facts = {for (final l in lines) ...l.facts};
    return Semantics(
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final l in lines) ...[
            Text(l.text, style: type.body.copyWith(color: l.correctable ? colors.ink : colors.ink2)),
            const SizedBox(height: MmSpace.s4),
          ],
          if (facts.isNotEmpty) NotQuiteRight(facts: facts),
        ],
      ),
    );
  }
}

/// The quiet link that opens the correction sheet for [facts].
class NotQuiteRight extends StatelessWidget {
  const NotQuiteRight({super.key, required this.facts});

  final Set<String> facts;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: PatternCopy.notQuiteRight,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      onTap: () => showPatternCorrection(context, facts),
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: 1,
          child: Text(
            PatternCopy.notQuiteRight,
            style: type.small.copyWith(
              color: pressed ? colors.ink : colors.ink2,
              fontWeight: FontWeight.w600,
              decoration: TextDecoration.underline,
              decorationColor: colors.ink3,
            ),
          ),
        ),
      ),
    );
  }
}

/// "Tell me what's true and I'll forget this.": forgets [facts]; the first two answers ask one
/// plain question.
Future<void> showPatternCorrection(BuildContext context, Set<String> facts) => showMmSheet<void>(
      context: context,
      title: PatternCopy.correctTitle,
      builder: (sheet) => PatternCorrection(facts: facts, onDone: () => Navigator.of(sheet).maybePop()),
    );

enum _Step { choose, askTime, askLength, done }

class PatternCorrection extends ConsumerStatefulWidget {
  const PatternCorrection({super.key, required this.facts, required this.onDone});

  final Set<String> facts;
  final VoidCallback onDone;

  /// The lengths the student can say.
  static const List<int> lengths = [10, 20, 30, 45, 60, 90];

  @override
  ConsumerState<PatternCorrection> createState() => _PatternCorrectionState();
}

class _PatternCorrectionState extends ConsumerState<PatternCorrection> {
  _Step _step = _Step.choose;
  String _receipt = '';

  StudyLogController get _log => ref.read(studyLogProvider.notifier);

  void _done(String receipt) => setState(() {
        _step = _Step.done;
        _receipt = receipt;
      });

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final showTime = widget.facts.contains(PatternFact.time);
    final showLength = widget.facts.contains(PatternFact.length);
    Widget option(String label, VoidCallback onTap) => Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8),
          child: KeyButton.secondary(label: label, onPressed: onTap),
        );
    final List<Widget> body = switch (_step) {
      _Step.choose => [
          if (showTime) option(PatternCopy.correctTime, () => setState(() => _step = _Step.askTime)),
          if (showLength) option(PatternCopy.correctLength, () => setState(() => _step = _Step.askLength)),
          option(PatternCopy.correctForget, () {
            _log.forget(widget.facts);
            _done(PatternCopy.forgotAll);
          }),
        ],
      _Step.askTime => [
          Text(PatternCopy.askTime, style: type.lead),
          const SizedBox(height: MmSpace.s12),
          for (final w in StudyWindow.values)
            option(PatternCopy.windowName(w), () {
              _log.stateWindow(w);
              _done(PatternCopy.forgotTime);
            }),
        ],
      _Step.askLength => [
          Text(PatternCopy.askLength, style: type.lead),
          const SizedBox(height: MmSpace.s12),
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s8,
            children: [
              for (final m in PatternCorrection.lengths)
                MmChip(
                  label: '$m min',
                  selected: false,
                  onTap: () {
                    _log.stateLength(m);
                    _done(PatternCopy.forgotLength(m));
                  },
                ),
            ],
          ),
        ],
      _Step.done => [
          Semantics(liveRegion: true, child: Text(_receipt, style: type.body.copyWith(color: colors.ink))),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: PatternCopy.done, onPressed: widget.onDone),
        ],
    };
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: body);
  }
}
