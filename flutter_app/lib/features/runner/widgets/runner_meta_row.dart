import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/session/save_state.dart';
import '../../../core/theme/theme.dart';
import 'save_glyph.dart';

/// The line under the top bar: the subject and chapter on the left (up to two lines, so a long
/// chapter name is read in full), in practice the static time it stays open until as a chip that
/// follows the words (no ticking clock; from 1.2x text it sits in a row of its own under them),
/// and the save state on the right once there is an answer to save. The line always reserves its
/// two lines, so a short name or a long one never moves what is below. A 5 or 1 minute warning
/// takes the left side for three seconds, and answers held back by the network take the line.
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

  /// The line's height at normal text size: two lines of caption (18 dp each). Shorter than a
  /// finger, so the retry fills it and the runner wraps the line in a `TapSlop` that makes up
  /// the rest of its 48 dp ([retryShowing]). It grows with the text size, never with the words.
  static const double height = 36;

  /// From this text scale the chip would crowd a long name: it goes under the name instead of
  /// after it, in a row of its own that is always there.
  static const double _stackedScale = 1.2;

  /// True while the line offers the retry, which then needs the taller touch band.
  static bool retryShowing(SaveSnapshot snapshot, {required bool canRetry}) => canRetry && snapshot.state == SaveState.notSaved;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final stacked = openUntil != null && MediaQuery.textScalerOf(context).scale(1) >= _stackedScale;
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
            final glyph = showSave || snapshot.state != SaveState.saved;
            final line = subjectLine;
            // The subject keeps its space while a warning covers it, so the row never changes
            // height under the question.
            final Widget left = Stack(
              alignment: Alignment.centerLeft,
              children: [
                Opacity(opacity: 0, child: Text(reserved, style: type.caption, maxLines: 2)),
                Opacity(
                  opacity: warning == null ? 1 : 0,
                  child: Text.rich(
                    TextSpan(
                      text: line,
                      children: [
                        if (openUntil != null && !stacked) ...[
                          const TextSpan(text: ' '),
                          WidgetSpan(alignment: PlaceholderAlignment.middle, child: _OpenUntilChip(text: openUntil!, inline: true)),
                        ],
                      ],
                    ),
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
                  if (glyph) ...[const SizedBox(width: MmSpace.s12), SaveGlyph(snapshot: snapshot, onRetry: onRetrySave, lineHeight: height)],
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
            if (!stacked) return row;
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                row,
                const SizedBox(height: MmSpace.s4),
                Align(alignment: Alignment.centerLeft, child: _OpenUntilChip(text: openUntil!, inline: false)),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// "Open until 3:07 PM": the one fact a practice has instead of a clock, on its own chip after the
/// subject. Inline in the text it reports a little less than its painted height to the line it
/// sits in, so it never makes that line taller than a caption line: the reserved two lines stay
/// the row's height.
class _OpenUntilChip extends StatelessWidget {
  const _OpenUntilChip({required this.text, required this.inline});

  final String text;

  /// After the words, in the text; false is a row of its own under them.
  final bool inline;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chip = SizedBox(
      height: MediaQuery.textScalerOf(context).scale(18),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.sunken,
          borderRadius: MmRadius.pillAll,
          border: Border.all(color: colors.line),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
          // Shrink-wrapped: a Center would take the whole line and push the chip to the next one.
          child: Center(
            widthFactor: 1,
            child: Text(text, style: type.caption.copyWith(color: colors.ink2, fontSize: 12, height: 1), maxLines: 1, softWrap: false),
          ),
        ),
      ),
    );
    if (!inline) return chip;
    return Padding(
      padding: const EdgeInsets.only(left: MmSpace.s4),
      child: Align(widthFactor: 1, heightFactor: 0.6, child: chip),
    );
  }
}
