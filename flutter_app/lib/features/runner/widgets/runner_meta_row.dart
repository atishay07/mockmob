import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/session/save_state.dart';
import '../../../core/theme/theme.dart';
import 'save_glyph.dart';

/// The line under the top bar: the subject and chapter on the left (one line, ellipsis), in
/// practice the static time it stays open until as its own chip (no ticking clock), and the save
/// state on the right once there is an answer to save. A 5 or 1 minute warning takes the left side for three seconds, and answers
/// held back by the network take the whole line, so nothing below ever shifts.
class RunnerMetaRow extends StatelessWidget {
  const RunnerMetaRow({
    super.key,
    required this.subjectLine,
    required this.save,
    this.openUntil,
    this.showSave = true,
    this.warning,
    this.onRetrySave,
  });

  final String subjectLine;

  /// "Open until 7:27 AM" in practice; null in a mock (its timer is in the top bar).
  final String? openUntil;
  final ValueListenable<SaveSnapshot> save;

  /// False before the first answer: there is nothing to call saved yet.
  final bool showSave;

  /// "5 minutes left" while the warning shows.
  final String? warning;

  /// A tap on "Not saved yet. Tap to retry".
  final VoidCallback? onRetrySave;

  /// The line's height. Shorter than a finger, so the retry fills it and the runner wraps the
  /// line in a `TapSlop` that makes up the rest of its 48 dp ([retryShowing]).
  static const double height = 32;

  /// True while the line offers the retry, which then needs the taller touch band.
  static bool retryShowing(SaveSnapshot snapshot, {required bool canRetry}) => canRetry && snapshot.state == SaveState.notSaved;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // With large system text the chip would leave the subject no room: it drops to its own line,
    // right-aligned, and stays there for the whole session.
    final stacked = openUntil != null && MediaQuery.textScalerOf(context).scale(1) >= 1.2;
    // Chrome: grows to 1.3x with the system text size, like the top bar.
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: height),
        child: ValueListenableBuilder<SaveSnapshot>(
          valueListenable: save,
          builder: (context, snapshot, _) {
            final waiting = snapshot.state == SaveState.waitingForNetwork || snapshot.state == SaveState.notSaved;
            final glyph = showSave || snapshot.state != SaveState.saved;
            final line = subjectLine;
            // The subject keeps its space while a warning covers it, so the row never changes
            // height under the question.
            final Widget left = Stack(
              alignment: Alignment.centerLeft,
              children: [
                Opacity(
                  opacity: warning == null ? 1 : 0,
                  child: Text(
                    line,
                    style: type.caption.copyWith(color: colors.ink3),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (warning != null)
                  Positioned.fill(
                    child: Row(
                      children: [
                        Icon(LucideIcons.clock, size: 15, color: colors.warnText),
                        const SizedBox(width: MmSpace.s6),
                        Flexible(
                          child: Text(
                            warning!,
                            style: type.caption.copyWith(color: colors.warnText, fontWeight: FontWeight.w700),
                            maxLines: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            );
            final row = Row(
              children: [
                if (!waiting || warning != null) ...[
                  Expanded(child: left),
                  if (openUntil != null && !stacked) ...[const SizedBox(width: MmSpace.s8), _OpenUntilChip(text: openUntil!)],
                  if (glyph) ...[const SizedBox(width: MmSpace.s12), SaveGlyph(snapshot: snapshot, onRetry: onRetrySave, lineHeight: height)],
                ] else
                  Expanded(
                    child: Stack(
                      alignment: Alignment.centerRight,
                      children: [
                        Opacity(opacity: 0, child: Text(line, style: type.caption, maxLines: 1)),
                        SaveGlyph(snapshot: snapshot, full: true, onRetry: onRetrySave, lineHeight: height),
                      ],
                    ),
                  ),
              ],
            );
            if (!stacked) return row;
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                row,
                const SizedBox(height: MmSpace.s4),
                Align(
                  alignment: Alignment.centerRight,
                  child: _OpenUntilChip(text: openUntil!),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// "Open until 3:07 PM": the one fact a practice has instead of a clock, on its own chip so the
/// subject never wraps around it.
class _OpenUntilChip extends StatelessWidget {
  const _OpenUntilChip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.sunken,
        borderRadius: MmRadius.pillAll,
        border: Border.all(color: colors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 3),
        child: Text(text, style: type.caption.copyWith(color: colors.ink2), maxLines: 1, softWrap: false),
      ),
    );
  }
}
