import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/ask_mobi_context.dart';
import 'data/ask_sheet_controller.dart';
import 'widgets/ask_sheet.dart';

export 'data/ask_mobi_context.dart';
export 'data/ask_mock_lines.dart';
export 'widgets/ask_entries.dart' show AskMobiLink, AskMobiPracticeRow;
export 'widgets/ask_mobi_button.dart' show AskDoor, AskKeyLabel, AskMobiButton, openAskMobiScreen;
export 'widgets/ask_mobi_card.dart' show AskMobiCard;

/// Opens Ask Mobi over the screen the student is on, already about [about] (ASK-MOBI-1018 3).
///
/// The one function every other screen calls:
///
/// * a question (Review, the result's answer sheet): `AskMobiContext.question(number: 7,
///   ref: '$attemptId:$questionId', stem: ..., chapter: ..., pickLetter: ..., keyLetter: ...)`;
/// * a mock (the result's marks): `AskMobiContext.mock(label: 'Mock 3', attemptId: ...,
///   lines: ['Partnership: 12 marks', ...])`;
/// * Today's "Why this?": `AskMobiContext.today(reason: ..., facts: [...])`;
/// * Practice: `const AskMobiContext.practice()`;
/// * anywhere else: `const AskMobiContext.page()`.
///
/// Opening about the same thing again continues that conversation; anything new starts one. The
/// label every entry uses is "Ask Mobi about Q7" (or "Ask Mobi about this mock"), never another.
Future<void> openAskMobi(BuildContext context, AskMobiContext about) {
  ProviderScope.containerOf(context, listen: false).read(askSheetScopeProvider.notifier).open(about);
  return showAskMobiSheet(context);
}

/// "Ask Mobi about Q7": the one label for a question entry.
String askMobiAboutLabel(int? number) => number == null ? 'Ask Mobi about this question' : 'Ask Mobi about Q$number';

/// "Ask Mobi about this mock".
const String askMobiAboutMock = 'Ask Mobi about this mock';

/// The same entry on a Quick, Smart or chapter set's result, in the same words with the paper's own noun.
const String askMobiAboutSet = 'Ask Mobi about this set';

/// Today's entry, in the same words.
const String askMobiAboutToday = 'Ask Mobi about today';
