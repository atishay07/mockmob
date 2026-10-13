import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/session/save_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' hide SaveState;
import '../copy.dart';

/// The save state of the runner in three shapes and plain words (spec 5.5):
///
/// - Saved: an inked bubble with a check. Only when the server acknowledged every answer.
/// - Saving: a turning ring.
/// - On this phone: a phone outline, with the count while the network holds answers back.
/// - Not saved yet: a retry arrow, tappable. The server refused the answers and will not be asked
///   again by itself; the answers are still on this phone.
///
/// A polite live region, so TalkBack hears changes only.
class SaveGlyph extends StatelessWidget {
  const SaveGlyph({super.key, required this.snapshot, this.full = false, this.onRetry});

  final SaveSnapshot snapshot;

  /// Called by a tap on the "Not saved yet" state.
  final VoidCallback? onRetry;

  /// Spells out "waiting for network" when the line has room.
  final bool full;

  static String wordsFor(SaveSnapshot s, {bool short = false}) => switch (s.state) {
    SaveState.saved => RunnerCopy.saved,
    SaveState.saving => RunnerCopy.saving,
    SaveState.waitingForNetwork => short ? RunnerCopy.waitingShort(s.unsyncedAnswers) : RunnerCopy.waiting(s.unsyncedAnswers),
    SaveState.onThisPhone => RunnerCopy.onThisPhone,
    SaveState.notSaved => RunnerCopy.notSavedYet,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final notSaved = snapshot.state == SaveState.notSaved;
    final waiting = snapshot.state == SaveState.waitingForNetwork || notSaved;
    final Widget glyph = switch (snapshot.state) {
      SaveState.saved => SizedBox.square(
        dimension: 16,
        child: Stack(
          alignment: Alignment.center,
          children: [
            const Bubble(state: BubbleState.filled, size: 16, animate: false),
            Icon(LucideIcons.check, size: 10, color: colors.voltInk),
          ],
        ),
      ),
      SaveState.saving => MmSpinner(color: colors.ink2, size: 14, strokeWidth: 1.8),
      SaveState.notSaved => Icon(LucideIcons.refreshCw, size: 15, color: colors.warnText),
      SaveState.waitingForNetwork || SaveState.onThisPhone => Icon(LucideIcons.smartphone, size: 15, color: waiting ? colors.warnText : colors.ink2),
    };
    final row = Semantics(
      container: true,
      liveRegion: true,
      button: notSaved && onRetry != null,
      onTap: notSaved ? onRetry : null,
      label: wordsFor(snapshot),
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          glyph,
          const SizedBox(width: MmSpace.s6),
          Flexible(
            child: Text(
              wordsFor(snapshot, short: !full),
              style: type.caption.copyWith(color: waiting ? colors.warnText : colors.ink2),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
    if (!notSaved || onRetry == null) return row;
    return GestureDetector(behavior: HitTestBehavior.opaque, onTap: onRetry, child: row);
  }
}
