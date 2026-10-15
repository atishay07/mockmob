import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode;
import '../copy.dart';
import '../widgets/you_motion.dart';

/// The celebration strip under the Celebrations choice: a 64 dp Mobi who plays what the chosen
/// level really does, on the student's own change and again on a tap.
///
/// Full is a celebrate, Quiet is a small nod, Off is nothing at all: he stands
/// still and the line says so. The level is pinned for the Mobi inside the strip, so the preview
/// is exactly what the setting will do everywhere else. It plays only after a change or a tap,
/// never by itself, and holds a still pose under reduced motion.
class CelebrationPreview extends ConsumerStatefulWidget {
  const CelebrationPreview({super.key, required this.mode});

  final CelebrationMode mode;

  /// The act each level plays in the preview; null is Off: nothing plays.
  static MobiAct? actFor(CelebrationMode mode) => switch (mode) {
        CelebrationMode.full => MobiAct.celebrate,
        CelebrationMode.quiet => MobiAct.nod,
        CelebrationMode.off => null,
      };

  /// The line beside Mobi for [mode].
  static String lineFor(CelebrationMode mode) => switch (mode) {
        CelebrationMode.full => YouCopy.previewFull,
        CelebrationMode.quiet => YouCopy.previewQuiet,
        CelebrationMode.off => YouCopy.previewOff,
      };

  static MobiCelebrationLevel levelFor(CelebrationMode mode) => celebrationLevelFor(mode);

  @override
  ConsumerState<CelebrationPreview> createState() => _CelebrationPreviewState();
}

class _CelebrationPreviewState extends ConsumerState<CelebrationPreview> {
  final MobiController _mobi = MobiController();
  Timer? _settle;

  @override
  void didUpdateWidget(CelebrationPreview old) {
    super.didUpdateWidget(old);
    if (old.mode != widget.mode) _play();
  }

  @override
  void dispose() {
    _settle?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  void _play() {
    final act = CelebrationPreview.actFor(widget.mode);
    _settle?.cancel();
    if (act == null) {
      // Off: Mobi stands still. Nothing plays and nothing is announced beyond the words.
      _mobi.react(MobiAct.idle);
      return;
    }
    // A reaction, so reduced motion shows the still pose and the pinned level is honoured.
    _mobi.react(act);
  }

  void _tap() {
    unawaited(ref.read(hapticsProvider).tick().catchError((Object _) {}));
    _play();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final line = CelebrationPreview.lineFor(widget.mode);
    return Semantics(
      container: true,
      button: true,
      label: YouCopy.previewLabel(line),
      onTap: _tap,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _tap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Row(
            children: [
              // The level is pinned here so the preview shows what the setting does.
              MobiCelebrations(
                level: CelebrationPreview.levelFor(widget.mode),
                child: Mobi(pose: MobiPose.idle, size: 64, controller: _mobi, entrance: MobiAct.idle),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: YouNote(line, style: type.small.copyWith(color: colors.ink2))),
            ],
          ),
        ),
      ),
    );
  }
}
