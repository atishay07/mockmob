import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/data/feed_api.dart' show feedApiProvider, reportQuestion;

/// Under an explanation Mobi wrote with AI (a mistake repair, Fix it for good): one plain line that it can be wrong, and
/// "Report this explanation" (L-06, Google Play's AI-generated content policy). The report goes to the question's own
/// report queue, the one the website's moderators read, marked as being about the AI explanation, so it reaches a person
/// on today's server. A report says only what happened: it reached us, or it did not.
class AiExplanationNote extends ConsumerStatefulWidget {
  const AiExplanationNote({super.key, required this.questionId, required this.surface, this.excerpt});

  final String questionId;

  /// Where the explanation was read: `repair` or `fix`.
  final String surface;

  /// The start of the explanation being reported, so the check sees what the student saw.
  final String? excerpt;

  @override
  ConsumerState<AiExplanationNote> createState() => _AiExplanationNoteState();
}

class _AiExplanationNoteState extends ConsumerState<AiExplanationNote> {
  bool _sending = false;
  bool _sent = false;

  Future<void> _report() async {
    if (_sending || _sent) return;
    final reason = await showMmSheet<String>(
      context: context,
      title: AiNoteCopy.reportTitle,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final r in AiNoteCopy.reasons) ...[
            MmSelectRow(title: r, selected: false, onTap: () => Navigator.of(sheet).pop(r)),
            const SizedBox(height: MmSpace.s8),
          ],
        ],
      ),
    );
    if (reason == null || !mounted) return;
    setState(() => _sending = true);
    final excerpt = widget.excerpt?.trim();
    final ok = await reportQuestion(
      ref.read(feedApiProvider),
      widget.questionId,
      reason,
      flow: 'review',
      extra: {
        'about': 'ai_explanation',
        'surface': widget.surface,
        if (excerpt != null && excerpt.isNotEmpty) 'excerpt': excerpt.length > 600 ? excerpt.substring(0, 600) : excerpt,
      },
    );
    if (!mounted) return;
    setState(() {
      _sending = false;
      _sent = ok;
    });
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(ok ? AiNoteCopy.sent : AiNoteCopy.failed), behavior: SnackBarBehavior.floating));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: ExcludeSemantics(child: Icon(LucideIcons.sparkles, size: 14, color: colors.ink3))),
            const SizedBox(width: MmSpace.s8),
            Expanded(child: Text(AiNoteCopy.caveat, style: type.caption.copyWith(color: colors.ink2))),
          ],
        ),
        if (_sent)
          Padding(
            padding: const EdgeInsets.only(left: 22, top: MmSpace.s8),
            child: Semantics(liveRegion: true, child: Text(AiNoteCopy.sent, style: type.caption.copyWith(color: colors.ink2))),
          )
        else
          Padding(
            padding: const EdgeInsets.only(left: 14),
            child: MmPressable(
              semanticsLabel: AiNoteCopy.reportKey,
              onTap: _sending ? null : _report,
              haptic: MmPressHaptic.selection,
              focusRadius: MmRadius.smallAll,
              builder: (context, pressed, _) => ConstrainedBox(
                constraints: const BoxConstraints(minHeight: MmTarget.min),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                  child: Align(
                    widthFactor: 1,
                    child: Text(
                      _sending ? AiNoteCopy.sending : AiNoteCopy.reportKey,
                      style: type.caption.copyWith(
                        color: pressed || _sending ? colors.ink3 : colors.ink,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                        decorationColor: colors.lineStrong,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The words of the AI note, in the owner's voice: plain, no exclamation marks.
abstract final class AiNoteCopy {
  static const caveat = 'Mobi writes this explanation with AI, so it can be wrong. Check it against the answer key.';
  static const reportKey = 'Report this explanation';
  static const sending = 'Sending your report';
  static const reportTitle = 'What is wrong with this explanation?';
  static const reasons = ['It explains the answer wrongly', 'It is confusing', 'It is unsafe or unkind', 'Something else'];
  static const sent = 'Reported. It is saved with this question for review.';
  static const failed = 'The report did not reach us. Try again in a moment.';
}
