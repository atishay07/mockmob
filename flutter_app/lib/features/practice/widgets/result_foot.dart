import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show LateNightLine;
import '../copy.dart';

/// The one main thing to do next, said as what it does.
class ResultFootAction {
  const ResultFootAction(this.label, this.onPressed, {this.note});

  final String label;
  final VoidCallback onPressed;

  /// One caption under the key, when the key alone would not say what it opens.
  final String? note;
}

/// The pinned foot of a result (RESULT-1017 4.1): the next move as the screen's one volt key, its cost and balance
/// under it, and on a practice set "Finish for now".
class ResultFoot extends StatelessWidget {
  const ResultFoot({super.key, required this.primary, this.onFinish, required this.showFinish, this.lateLine = false, this.onSeePaper, this.repair});

  /// "See it in Your papers" (G20, D106): a quiet key beside "Finish for now" that opens Your
  /// papers on this paper's row, so the student learns where every paper lives. Null hides it.
  final VoidCallback? onSeePaper;

  /// The quiet key's words: where it goes, said plainly (a first-time student is already looking
  /// at the paper, so "See this paper" alone would not say what it opens).
  static const String seePaperLabel = 'See it in Your papers';

  /// The mistake's own repair key ("Repair Q9", with its cost as the spoken note) when the one next move is
  /// something else (a chapter set after a weak paper): a quiet key that leads the row under the volt one, so
  /// the repair v15.2 offered is still one tap away and the volt key stays the one dominant move (D108, R4).
  /// Null when the next move is the repair itself or there is nothing to repair.
  final ResultFootAction? repair;

  final ResultFootAction primary;
  final VoidCallback? onFinish;

  /// At large text sizes the quiet key moves into the scrolling page so the pinned foot stays small.
  final bool showFinish;

  /// Late at night, after a calm or good set: the "good place to stop for tonight" line, under the
  /// key and above "Finish for now". The line decides for itself whether it shows (the setting, the
  /// student's own clock, once a night), so this only says that this result may carry it.
  final bool lateLine;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    // Solid ground under the keys; the page above dims into it through a 24 dp fade (BarFade on
    // the scroller), so there is no rule and no half row (SPACING.md 4.5).
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KeyButton(
              label: primary.label,
              semanticsLabel: primary.note == null ? null : '${primary.label}. ${primary.note}',
              onPressed: primary.onPressed,
            ),
            if (primary.note != null) ...[
              const SizedBox(height: MmSpace.s4),
              ExcludeSemantics(
                child: Text(
                  primary.note!,
                  style: context.mmType.caption.copyWith(color: colors.ink2),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
            if (lateLine) const LateNightLine(),
            if (showFinish && (onFinish != null || onSeePaper != null || repair != null)) ...[
              const SizedBox(height: MmSpace.s4),
              // The two quiet ways out share one row (they wrap to two only when the words need it),
              // so the foot is no taller than it was with "Finish for now" alone.
              Wrap(
                alignment: WrapAlignment.center,
                spacing: MmSpace.s8,
                children: [
                  if (repair != null)
                    KeyButton.quiet(
                      key: const ValueKey('result-foot-repair'),
                      label: repair!.label,
                      semanticsLabel: repair!.note == null ? null : '${repair!.label}. ${repair!.note}',
                      onPressed: repair!.onPressed,
                    ),
                  if (onSeePaper != null) KeyButton.quiet(label: seePaperLabel, onPressed: onSeePaper!),
                  if (onFinish != null) KeyButton.quiet(label: PracticeCopy.finishForNow, onPressed: onFinish!),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
