import 'package:flutter/widgets.dart';

import 'choice_deck.dart';
import 'choice_glyphs.dart';

export 'choice_deck.dart' show ChoiceOption;
export 'choice_glyphs.dart' show ChoiceGlyphKind;

/// The quick-start sheet's choices (the sheet the Start button morphs into) as a deck instead of
/// five identical rows: the first choice leads (Resume when a session is open, else Quick 10),
/// full width with the lit edge and a go disc; the next ones pair up; an odd one runs wide; and
/// "Ask your record" (id [askId]) closes the deck as a quiet row.
///
/// The sheet itself lives in `lib/core/router/quick_start.dart`, which decides which choices
/// exist and where each goes; it hands them here in its own order. Tiles are drawn opaque
/// ([ChoiceDeck.solid]) because the sheet lets a faint wash of the page through.
class QuickStartDeck extends StatelessWidget {
  const QuickStartDeck({super.key, required this.options});

  final List<ChoiceOption> options;

  /// The id that marks the quiet "Ask your record" choice.
  static const String askId = 'ask';

  /// The glyph each quick-start choice draws, by id: `resume`, `quick`, `mock`, `nta`, `repair`,
  /// `ask`.
  static ChoiceGlyphKind glyphFor(String id) => switch (id) {
    'resume' => ChoiceGlyphKind.resume,
    'quick' => ChoiceGlyphKind.quick,
    'mock' => ChoiceGlyphKind.mock,
    'nta' => ChoiceGlyphKind.nta,
    'repair' => ChoiceGlyphKind.repair,
    _ => ChoiceGlyphKind.ask,
  };

  @override
  Widget build(BuildContext context) => ChoiceDeck(rows: arrangeChoices(options, quiet: const {askId}), solid: true);
}
