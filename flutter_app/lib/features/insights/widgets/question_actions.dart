import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/feed_api.dart';
import '../data/practice_question.dart';
import '../data/saved_repository.dart';
import '../insights_paths.dart';

void _say(BuildContext context, String text) {
  ScaffoldMessenger.maybeOf(context)
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text), behavior: SnackBarBehavior.floating));
}

/// Save, the quality vote, flag a problem and ask why, as quiet icon keys under a question.
/// Each changes only when the server answers.
class QuestionActions extends ConsumerStatefulWidget {
  const QuestionActions({super.key, required this.question, required this.flow, required this.onVote, this.revealed = false});

  final PracticeQuestion question;

  /// `explore` or `review`, for the interaction log.
  final String flow;
  final Future<bool> Function(String? vote) onVote;

  /// "Ask why" appears once the answer is out.
  final bool revealed;

  @override
  ConsumerState<QuestionActions> createState() => _QuestionActionsState();
}

class _QuestionActionsState extends ConsumerState<QuestionActions> {
  String? _voting;

  Future<void> _save(bool saved) async {
    final outcome = await ref.read(saveControllerProvider.notifier).set(widget.question.id, saved: !saved, source: widget.flow == 'review' ? 'saved' : 'explore');
    if (!mounted) return;
    switch (outcome) {
      case SaveDone(saved: true):
        ref.read(hapticsProvider).settle();
      case SaveDone():
        break;
      case SaveLimitReached():
        _say(context, InsightsCopy.limitReached);
      case SaveFailed():
        _say(context, InsightsCopy.saveFailed);
    }
  }

  Future<void> _vote(String direction) async {
    if (_voting != null) return;
    final next = widget.question.userVote == direction ? null : direction;
    setState(() => _voting = direction);
    final ok = await widget.onVote(next);
    if (!mounted) return;
    setState(() => _voting = null);
    if (!ok) _say(context, InsightsCopy.voteFailed);
  }

  Future<void> _flag() async {
    final reason = await showMmSheet<String>(
      context: context,
      title: InsightsCopy.flagTitle,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final r in InsightsCopy.flagReasons) ...[
            MmSelectRow(title: r, selected: false, onTap: () => Navigator.of(sheet).pop(r)),
            const SizedBox(height: MmSpace.s8),
          ],
        ],
      ),
    );
    if (reason == null || !mounted) return;
    final ok = await reportQuestion(ref.read(feedApiProvider), widget.question.id, reason, flow: widget.flow);
    if (mounted) _say(context, ok ? InsightsCopy.flagSent : InsightsCopy.flagFailed);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final q = widget.question;
    final marks = ref.watch(saveControllerProvider);
    final saved = marks.savedOf(q);
    final saving = marks.pending.contains(q.id);
    // The keys wrap onto a second line instead of overflowing at large text; Ask why and flag
    // stay together on the right.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _ActionKey(
                icon: saved ? LucideIcons.bookmarkCheck : LucideIcons.bookmark,
                label: saving ? InsightsCopy.saving : (saved ? InsightsCopy.saved : InsightsCopy.save),
                semantics: saved ? InsightsCopy.unsave : InsightsCopy.save,
                active: saved,
                busy: saving,
                onTap: saving ? null : () => _save(saved),
              ),
              _ActionKey(
                icon: LucideIcons.thumbsUp,
                label: '${q.upvotes}',
                semantics: '${InsightsCopy.voteUp}, ${q.upvotes}',
                active: q.userVote == 'up',
                busy: _voting == 'up',
                onTap: () => _vote('up'),
              ),
              _ActionKey(
                icon: LucideIcons.thumbsDown,
                label: '${q.downvotes}',
                semantics: '${InsightsCopy.voteDown}, ${q.downvotes}',
                active: q.userVote == 'down',
                busy: _voting == 'down',
                onTap: () => _vote('down'),
              ),
            ],
          ),
        ),
        if (widget.revealed)
          _ActionKey(
            icon: LucideIcons.messageCircleQuestion,
            label: InsightsCopy.askWhy,
            semantics: InsightsCopy.askWhy,
            onTap: () => context.push(InsightsPaths.ask, extra: InsightsCopy.askAboutQuestion(q.body, q.correctKey)),
          ),
        IconButton(
          tooltip: InsightsCopy.flag,
          onPressed: _flag,
          icon: Icon(LucideIcons.flag, size: 20, color: colors.ink2),
        ),
      ],
    );
  }
}

class _ActionKey extends StatelessWidget {
  const _ActionKey({required this.icon, required this.label, required this.semantics, required this.onTap, this.active = false, this.busy = false});

  final IconData icon;
  final String label;
  final String semantics;
  final VoidCallback? onTap;
  final bool active;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ink = active ? colors.ink : colors.ink2;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: semantics,
      selected: active,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy)
                SizedBox.square(dimension: 18, child: MmSpinner(color: colors.ink2))
              else
                Icon(icon, size: 20, color: active ? colors.accentText : ink),
              const SizedBox(width: MmSpace.s6),
              Text(label, style: type.label.copyWith(color: ink, fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ),
        ),
      ),
    );
  }
}
