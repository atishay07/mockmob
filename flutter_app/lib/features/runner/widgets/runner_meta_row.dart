import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/session/save_state.dart';
import '../../../core/theme/theme.dart';
import 'save_glyph.dart';

/// The line under the top bar: the subject and chapter on the left, the save state on the
/// right. A 5 or 1 minute warning takes the left side for three seconds, and answers held back
/// by the network take the whole line, so nothing below ever shifts.
class RunnerMetaRow extends StatelessWidget {
  const RunnerMetaRow({super.key, required this.subjectLine, required this.save, this.warning});

  final String subjectLine;
  final ValueListenable<SaveSnapshot> save;

  /// "5 minutes left" while the warning shows.
  final String? warning;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Chrome: grows to 1.3x with the system text size, like the top bar.
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 32),
        child: ValueListenableBuilder<SaveSnapshot>(
          valueListenable: save,
          builder: (context, snapshot, _) {
            final waiting = snapshot.state == SaveState.waitingForNetwork;
            // The subject keeps its space while a warning covers it, so the row never changes
            // height under the question.
            final Widget left = Stack(
              alignment: Alignment.centerLeft,
              children: [
                Opacity(
                  opacity: warning == null ? 1 : 0,
                  child: Text(subjectLine, style: type.caption.copyWith(color: colors.ink3), maxLines: 2),
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
            return Row(
              children: [
                if (!waiting || warning != null) ...[
                  Expanded(child: left),
                  const SizedBox(width: MmSpace.s12),
                  SaveGlyph(snapshot: snapshot),
                ] else
                  Expanded(
                    child: Stack(
                      alignment: Alignment.centerRight,
                      children: [
                        Opacity(opacity: 0, child: Text(subjectLine, style: type.caption, maxLines: 2)),
                        SaveGlyph(snapshot: snapshot, full: true),
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
