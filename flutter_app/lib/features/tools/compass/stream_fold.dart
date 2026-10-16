// One stream of "All N open to you" as a folded row (L23): its name and what is inside ("26
// programmes · up to 54 colleges", or with an estimate "your range reaches 9"), opened in place.
// The student's own stream opens by itself, and every stream opens while a search is typed, so the
// page reads as four rows instead of thirty-five and each row says why it is worth opening.

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

abstract final class StreamFoldCopy {
  static String note(int programmes, int maxColleges, int? reach) {
    final p = programmes == 1 ? '1 programme' : '$programmes programmes';
    if (reach != null) return '$p · your range reaches $reach';
    return '$p · up to $maxColleges ${maxColleges == 1 ? 'college' : 'colleges'}';
  }

  static String semantics(String stream, String note, bool open) => '$stream. $note. ${open ? 'Open' : 'Folded'}';
}

class StreamFold extends StatelessWidget {
  const StreamFold({super.key, required this.stream, required this.note, required this.open, required this.onToggle, required this.child});

  final String stream;
  final String note;
  final bool open;
  final VoidCallback onToggle;

  /// The stream's rows, built only while open.
  final WidgetBuilder child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final header = MmPressable(
      semanticsLabel: StreamFoldCopy.semantics(stream, note, open),
      onTap: onToggle,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Semantics(header: true, child: Text(stream, style: type.labelLarge.copyWith(fontSize: 16, color: colors.ink))),
                    const SizedBox(height: 2),
                    Text(note, style: type.caption.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              AnimatedRotation(
                turns: open ? 0.5 : 0,
                duration: reduced ? Duration.zero : Motion.ui,
                curve: Motion.glide,
                child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink2),
              ),
            ],
          ),
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        header,
        _FoldBody(open: open, child: child),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: Divider(height: 1, thickness: 1, color: colors.line),
        ),
      ],
    );
  }
}

/// The fold's body: grows from the top over 300 ms on Glide and fades in; nothing is built while
/// closed. Under reduced motion it simply appears.
class _FoldBody extends StatelessWidget {
  const _FoldBody({required this.open, required this.child});

  final bool open;
  final WidgetBuilder child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return open ? child(context) : const SizedBox(width: double.infinity);
    return AnimatedSize(
      duration: Motion.glideDuration,
      curve: Motion.glide,
      alignment: Alignment.topCenter,
      child: MmOverlapSwitcher.fade(
        duration: Motion.ui,
        child: open ? KeyedSubtree(key: const ValueKey('open'), child: child(context)) : const SizedBox(key: ValueKey('closed'), width: double.infinity),
      ),
    );
  }
}
