import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import '../widgets/key_button.dart';
import '../widgets/materials/shape.dart';
import 'feature_notes.dart';

/// One inline note that introduces a feature at the moment it is useful (F18): what it is in a
/// lead of two or three words, one sentence on what it does for the student now, and one key that
/// goes there. "Got it" closes it for good. It sits in the page's own flow on a quiet sunken
/// ground, never over content, never a popup, and it shows at most three times and never again
/// once the student has used the feature or closed it.
///
/// Draws nothing until the notes' memory has been read, nothing when the note is closed, and one
/// frame of nothing is all that a closed note ever costs the layout.
class FeatureNoteView extends ConsumerStatefulWidget {
  const FeatureNoteView({super.key, required this.note, required this.lead, required this.text, this.actionLabel, this.onAction, this.gotIt = true});

  final FeatureNote note;

  /// The feature's name or what it does, two or three words ("Revise", "Mistake Lab").
  final String lead;

  /// One sentence about what it does for the student now.
  final String text;

  /// The key that goes to the feature, or null when the note sits beside the feature's own key.
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Whether "Got it" is offered (false when the feature's own key beside the note closes it).
  final bool gotIt;

  static const String gotItLabel = 'Got it';

  @override
  ConsumerState<FeatureNoteView> createState() => _FeatureNoteViewState();
}

class _FeatureNoteViewState extends ConsumerState<FeatureNoteView> {
  bool _counted = false;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(featureNotesProvider);
    if (!state.visible(widget.note)) return const SizedBox.shrink();
    if (!_counted) {
      _counted = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.read(featureNotesProvider.notifier).impression(widget.note);
      });
    }
    final colors = context.mmColors;
    final type = context.mmType;
    final notes = ref.read(featureNotesProvider.notifier);
    return MmEntrance(
      rise: 6,
      child: Semantics(
        container: true,
        label: '${widget.lead}. ${widget.text}',
        child: DecoratedBox(
          decoration: ShapeDecoration(color: colors.sunken, shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line))),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s8, MmSpace.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '${widget.lead}. ', style: type.labelLarge),
                        TextSpan(text: widget.text, style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                ),
                Wrap(
                  children: [
                    if (widget.actionLabel != null)
                      KeyButton.quiet(
                        label: widget.actionLabel!,
                        onPressed: () {
                          notes.done(widget.note);
                          widget.onAction?.call();
                        },
                      ),
                    if (widget.gotIt) KeyButton.quiet(label: FeatureNoteView.gotItLabel, onPressed: () => notes.done(widget.note)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
