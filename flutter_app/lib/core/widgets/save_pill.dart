import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../copy/state_words.dart';
import '../theme/theme.dart';
import 'mm_spinner.dart';

/// The three honest save states (spec 10): the answer is on this phone, being sent, or
/// acknowledged by the server.
enum SaveState {
  onThisPhone(StateWords.onThisPhone),
  sending(StateWords.sending),
  saved(StateWords.savedOnServer);

  const SaveState(this.words);

  final String words;
}

/// A small pill showing a [SaveState]. State is carried by words and a glyph, never colour
/// alone. It is a polite live region, so TalkBack announces changes only.
class SavePill extends StatelessWidget {
  const SavePill({super.key, required this.state, this.label});

  final SaveState state;

  /// Overrides the words, for a count such as "3 answers on this phone".
  final String? label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = label ?? state.words;

    final Widget glyph = switch (state) {
      SaveState.onThisPhone => Icon(LucideIcons.smartphone, size: 14, color: colors.ink2),
      SaveState.sending => MmSpinner(color: colors.ink2, size: 14, strokeWidth: 2),
      SaveState.saved => Icon(LucideIcons.check, size: 14, color: colors.ink),
    };

    return Semantics(
      container: true,
      liveRegion: true,
      label: words,
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.sunken,
          borderRadius: MmRadius.pillAll,
          border: Border.all(color: colors.line),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              glyph,
              const SizedBox(width: MmSpace.s8),
              Text(words, style: type.label.copyWith(color: colors.ink)),
            ],
          ),
        ),
      ),
    );
  }
}
