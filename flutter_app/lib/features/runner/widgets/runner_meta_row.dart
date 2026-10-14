import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/session/save_state.dart';
import '../../../core/theme/theme.dart';
import 'save_glyph.dart';

/// The line under the top bar: the subject and chapter on the left (up to two lines, so a long
/// chapter name is read in full) and the save state on the right once there is an answer to
/// save. The line always reserves its two lines, so a short name or a long one never moves what
/// is below. A 5 or 1 minute warning takes the left side for three seconds, and a notice (the
/// return after an interruption) takes it until it is dismissed: both replace the subject in
/// place, so nothing is stacked on top of the line and nothing under it moves. Answers held back
/// by the network take the whole line.
class RunnerMetaRow extends StatelessWidget {
  const RunnerMetaRow({
    super.key,
    required this.subjectLine,
    required this.save,
    this.showSave = true,
    this.warning,
    this.notice,
    this.onRetrySave,
  });

  final String subjectLine;
  final ValueListenable<SaveSnapshot> save;

  /// False before the first answer: there is nothing to call saved yet.
  final bool showSave;

  /// "5 minutes left" while the warning shows.
  final String? warning;

  /// "Away for 2 minutes 10 seconds. Timer kept running. Answers saved." until it is dismissed.
  /// A warning, while it shows, goes first.
  final String? notice;

  /// A tap on "Not saved yet. Tap to retry".
  final VoidCallback? onRetrySave;

  /// The line's height at normal text size: two lines of caption (18 dp each). Shorter than a
  /// finger, so the retry fills it and the runner wraps the line in a `TapSlop` that makes up
  /// the rest of its 48 dp ([retryShowing]). It grows with the text size, never with the words.
  static const double height = 36;

  /// True while the line offers the retry, which then needs the taller touch band.
  static bool retryShowing(SaveSnapshot snapshot, {required bool canRetry}) => canRetry && snapshot.state == SaveState.notSaved;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Two lines are always reserved for the subject (the hidden text), so the row is the same
    // height for a short name and a long one.
    final reserved = List.filled(2, 'x').join('\n');
    // Chrome: grows to 1.3x with the system text size, like the top bar.
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: height),
        child: ValueListenableBuilder<SaveSnapshot>(
          valueListenable: save,
          builder: (context, snapshot, _) {
            final waiting = snapshot.state == SaveState.waitingForNetwork || snapshot.state == SaveState.notSaved;
            final covered = warning != null || notice != null;
            final glyph = showSave || snapshot.state != SaveState.saved;
            // The subject keeps its space while a message covers it, so the row never changes
            // height under the question.
            final Widget left = Stack(
              alignment: Alignment.centerLeft,
              children: [
                Opacity(opacity: 0, child: Text(reserved, style: type.caption, maxLines: 2)),
                Opacity(
                  opacity: covered ? 0 : 1,
                  child: Text(
                    subjectLine,
                    style: type.caption.copyWith(color: colors.ink3),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (warning != null)
                  Positioned.fill(
                    child: Row(
                      children: [
                        Icon(LucideIcons.clock, size: 15, color: colors.warnText),
                        const SizedBox(width: MmSpace.s8),
                        Flexible(
                          child: Text(
                            warning!,
                            style: type.caption.copyWith(color: colors.warnText, fontWeight: FontWeight.w700),
                            maxLines: 1,
                          ),
                        ),
                      ],
                    ),
                  )
                else if (notice != null)
                  Positioned.fill(
                    child: Row(
                      children: [
                        Icon(LucideIcons.clock, size: 15, color: colors.ink2),
                        const SizedBox(width: MmSpace.s8),
                        Expanded(
                          child: Text(
                            notice!,
                            style: type.caption.copyWith(color: colors.ink),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            );
            return Row(
              children: [
                if (!waiting || covered) ...[
                  Expanded(child: left),
                  if (glyph) ...[
                    const SizedBox(width: MmSpace.s12),
                    SaveGlyph(snapshot: snapshot, onRetry: onRetrySave, lineHeight: height),
                  ],
                ] else
                  Expanded(
                    child: Stack(
                      alignment: Alignment.centerRight,
                      children: [
                        Opacity(opacity: 0, child: Text(reserved, style: type.caption, maxLines: 2)),
                        SaveGlyph(snapshot: snapshot, full: true, onRetry: onRetrySave, lineHeight: height),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
