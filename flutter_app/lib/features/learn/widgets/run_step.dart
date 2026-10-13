import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/learn_log.dart';
import '../data/run_controller.dart';
import '../models/run_item.dart';
import 'answer_inputs.dart';
import 'lesson_block.dart';
import 'rating_keys.dart';
import 'recall_card.dart';
import 'reveal_in.dart';
import 'screen_bits.dart';

/// What the student can do on a step. The run screen wires these to the run controller.
class RunStepActions {
  const RunStepActions({required this.reveal, required this.answer, required this.rate, required this.advance, required this.retry});

  final VoidCallback reveal;
  final void Function(Object value, {bool assisted}) answer;
  final ValueChanged<int> rate;
  final VoidCallback advance;
  final VoidCallback retry;
}

/// One step of a run: the card or lesson block with its inputs, and the keys pinned below.
/// Local input (the chosen option, typed text, hint shown) lives here and resets with each
/// step because the run screen keys this widget by the step.
class RunStep extends ConsumerStatefulWidget {
  const RunStep({super.key, required this.ui, required this.actions, required this.isLast});

  final RunUiState ui;
  final RunStepActions actions;

  /// The last step of the run: the closing key says finish.
  final bool isLast;

  @override
  ConsumerState<RunStep> createState() => _RunStepState();
}

class _RunStepState extends ConsumerState<RunStep> {
  final _text = TextEditingController();
  int? _selected;
  bool _hintShown = false;

  @override
  void initState() {
    super.initState();
    final item = widget.ui.run?.currentItem;
    if (item != null && item.type == RunItemType.unknown) {
      LearnLog.unknownStep(wireType: '${item.raw['type']}', itemId: item.id);
    }
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  RunUiState get _ui => widget.ui;
  bool get _sending => _ui.pending != null;

  void _submitText([String? _]) {
    final value = _text.text.trim();
    if (value.isEmpty || _sending) return;
    widget.actions.answer(value, assisted: _hintShown);
  }

  @override
  Widget build(BuildContext context) {
    final run = _ui.run!;
    final item = run.currentItem!;
    final feedback = run.currentFeedback;
    final revealed = run.revealed;

    final superseded = _ui.notice == RunNotice.supersededElsewhere;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, MmSpace.s24),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (superseded) ...[const _SupersededLine(), const SizedBox(height: MmSpace.s12)],
                      ..._content(item, feedback, revealed),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        _actions(item, revealed),
      ],
    );
  }

  List<Widget> _content(RunItem item, RunFeedback? feedback, bool revealed) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (item.isReading) {
      return [LessonBlock(block: item.raw)];
    }
    if (item.type == RunItemType.unknown) {
      return [
        if ((item.prompt ?? item.title) != null) ...[
          PromptCard(prompt: item.prompt, objective: item.title),
          const SizedBox(height: MmSpace.s16),
        ],
        Semantics(liveRegion: true, child: Text(LearnCopy.unknownStep, style: type.body.copyWith(color: colors.ink2))),
      ];
    }
    final notice = switch (_ui.notice) {
      RunNotice.connectToReveal => LearnCopy.connectToReveal,
      RunNotice.connectToCheck => LearnCopy.connectToCheck,
      _ => null,
    };
    final prompt = PromptCard(prompt: item.prompt, sentence: item.context, objective: item.objective ?? item.title);

    if (item.isSelfRated) {
      return [
        prompt,
        const SizedBox(height: MmSpace.s16),
        if (!revealed)
          RevealPanel(
            onTap: _sending
                ? null
                : () {
                    ref.read(hapticsProvider).tick();
                    widget.actions.reveal();
                  },
            loading: _sending,
            note: notice,
          )
        else
          RevealIn(
            child: AnswerPanel(
              answer: feedback?.answer ?? item.answerText,
              explanation: feedback?.explanation ?? item.explanation,
              cue: feedback?.cue ?? item.cue,
            ),
          ),
      ];
    }

    if (item.isChecked) {
      final chosen = feedback?.chosen == null ? null : item.options.indexOf(feedback!.chosen!);
      return [
        prompt,
        const SizedBox(height: MmSpace.s16),
        if (item.type == RunItemType.choice)
          revealed
              ? ResultOptions(options: item.options, correct: item.answerIndex, chosen: chosen == -1 ? null : chosen)
              : LiveOptions(
                  options: item.options,
                  selected: _selected,
                  onSelect: _sending
                      ? (_) {}
                      : (i) {
                          ref.read(hapticsProvider).tick();
                          setState(() => _selected = i);
                        },
                )
        else ...[
          AnswerField(
            controller: _text,
            hintText: item.inputHint ?? LearnCopy.typeAnswer,
            enabled: !revealed && !_sending,
            onSubmitted: _submitText,
          ),
          if (_hintShown && item.hint != null && !revealed) ...[
            const SizedBox(height: MmSpace.s8),
            Text('${LearnCopy.hintLabel}: ${item.hint!}', style: type.small.copyWith(color: colors.ink2)),
          ],
        ],
        if (notice != null && !revealed) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(liveRegion: true, child: Text(notice, style: type.body)),
        ],
        if (revealed && feedback != null) ...[
          const SizedBox(height: MmSpace.s16),
          RevealIn(child: FeedbackPanel(feedback: feedback, item: item)),
        ],
      ];
    }
    return [prompt];
  }

  Widget _actions(RunItem item, bool revealed) {
    final a = widget.actions;
    final pending = _ui.pending;

    // Waiting on the phone: say so plainly instead of offering the keys again.
    if (pending != null && !_ui.sending && pending.canWaitOffline) {
      final failed = _ui.notice == RunNotice.sendFailed;
      return PinnedActions(
        children: [
          Align(
            child: SavePill(
              state: SaveState.onThisPhone,
              label: failed ? LearnCopy.sendFailed : LearnCopy.reviewedOffline,
            ),
          ),
          if (failed) KeyButton.secondary(label: LearnCopy.tryAgain, onPressed: a.retry),
        ],
      );
    }

    if (item.type == RunItemType.unknown) {
      return PinnedActions(
        message: _ui.notice == RunNotice.sendFailed ? LearnCopy.sendFailed : null,
        children: [KeyButton(label: LearnCopy.skipStep, onPressed: _sending ? null : a.advance, loading: _sending)],
      );
    }

    if (item.isReading) {
      return PinnedActions(
        message: _ui.notice == RunNotice.sendFailed ? LearnCopy.sendFailed : null,
        children: [KeyButton(label: _closing, onPressed: _sending ? null : a.advance, loading: _sending)],
      );
    }

    if (item.isSelfRated) {
      if (!revealed) {
        return _ui.notice == RunNotice.sendFailed
            ? PinnedActions(message: LearnCopy.sendFailed, children: [KeyButton.secondary(label: LearnCopy.tryAgain, onPressed: a.retry)])
            : const SizedBox.shrink();
      }
      return PinnedActions(
        message: _ui.notice == RunNotice.sendFailed ? LearnCopy.sendFailed : null,
        children: [RatingKeys(onRate: a.rate, sending: pending?.type == 'rate' ? pending?.rating : null)],
      );
    }

    if (revealed) {
      return PinnedActions(
        message: _ui.notice == RunNotice.sendFailed ? LearnCopy.sendFailed : null,
        children: [KeyButton(label: _closing, onPressed: _sending ? null : a.advance, loading: _sending)],
      );
    }

    // A checked question that has not been answered yet.
    final isChoice = item.type == RunItemType.choice;
    return PinnedActions(
      message: _ui.notice == RunNotice.sendFailed ? LearnCopy.sendFailed : null,
      children: [
        ListenableBuilder(
          listenable: _text,
          builder: (context, _) {
            final ready = isChoice ? _selected != null : _text.text.trim().isNotEmpty;
            return KeyButton(
              label: LearnCopy.checkAnswer,
              loading: _sending,
              onPressed: !ready || _sending
                  ? null
                  : () => isChoice ? a.answer(_selected!, assisted: false) : _submitText(),
            );
          },
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (!isChoice && item.hint != null && !_hintShown)
              KeyButton.quiet(label: LearnCopy.showHint, onPressed: _sending ? null : () => setState(() => _hintShown = true)),
            KeyButton.quiet(
              label: LearnCopy.dontKnow,
              onPressed: _sending ? null : () => a.answer(isChoice ? -1 : '', assisted: false),
            ),
          ],
        ),
      ],
    );
  }

  String get _closing {
    final run = _ui.run!;
    if (!widget.isLast) return run.isLearn ? LearnCopy.continueKey : LearnCopy.nextCard;
    return run.isLearn ? LearnCopy.finishLesson : LearnCopy.finishRun;
  }
}

/// One plain line when the step the student answered had already been answered on another
/// device: their tap was not recorded, and the step on screen is the current one.
class _SupersededLine extends StatelessWidget {
  const _SupersededLine();

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Semantics(
      liveRegion: true,
      child: Text(LearnCopy.supersededElsewhere, style: type.body.copyWith(color: colors.ink2)),
    );
  }
}
