import 'model/next_move.dart' show MoveKind, ResultMove;

/// The words of the result's four layers (RESULT-1017 4.9), shared by the practice result and the full mock result.
/// Sentence case, no exclamation marks, no arrows on keys, 12-hour times. The rule-made lines (the receipt, the
/// costliest chapter, the next move's why, value and cost) come from `model/next_move.dart`.
abstract final class LayersCopy {
  // ---- Layer 2: the next move ---------------------------------------------------------------

  /// The panel's heading names the reason: "Why Q42 first", "Why this chapter first".
  static String whyTitle(ResultMove m) => switch (m.kind) {
    MoveKind.repair => 'Why Q${m.number} first',
    MoveKind.check => 'Why check Q${m.number} now',
    MoveKind.practise => m.chapter != null ? 'Why this chapter first' : 'Why a short set first',
    MoveKind.harder => 'Why a harder paper',
  };

  /// The cost line under the foot key: the cost and the balance on one line ("1 credit. You have 40."), so the pinned
  /// foot stays small (19 Oct walk, finding 28: the foot held a quarter of the screen). A repair's promise ("No charge
  /// if the repair cannot be written.") is said in the panel above, beside what the repair gives.
  static String? footNote(String? cost) {
    if (cost == null) return null;
    final line = cost.replaceFirst(' $repairNoCharge', '').replaceFirst(repairNoCharge, '').trim();
    return line.isEmpty ? null : line;
  }

  /// The repair's promise, under what a repair gives in the next-move panel.
  static const repairNoCharge = 'No charge if the repair cannot be written.';

  /// The foot key while a repair needs the network and there is none.
  static const repairsNeedConnection = 'Repairs need a connection';

  // ---- Layer 3: the mistakes ----------------------------------------------------------------

  static const inRepairOrder = 'In repair order: the ones most other students got right come first. Repaired ones say whether the fix held.';
  static const inPaperOrder = 'In paper order. Repaired ones say whether the fix held.';
  static const noAnswersTitle = 'No answers to repair';
  static String showAll(int n) => 'Show all $n';
  static const showFewer = 'Show fewer';

  /// The folded row of blanks: "10 left blank, 50 marks not earned".
  static String leftBlank(int n) => '$n left blank, ${n * 5} marks not earned';
  static String leftBlankSpoken(int n, {required bool open}) => '${leftBlank(n)}. ${open ? 'Fold away' : 'Show them'}';

  /// Answers whose key is being re-checked: no marks either way until the check ends.
  static String heldGroup(int n) => n == 1 ? '1 answer key being re-checked' : '$n answer keys being re-checked';

  static String yours(String letter) => '$letter yours';
  static String answer(String letter) => '$letter answer';
  static const marksLost = '−6';
  static String spokenCost(int marks) => '$marks marks lost';

  // Status chips (each from a real server state, never optimistic). A chip says a state, never an action (D15): the one
  // action of a mistake is its key, and that key has one label wherever it shows ("Repair Q12", "Check Q12 held").
  static const chipOpen = 'Not repaired';
  static const chipCheck = 'Repaired';
  static const chipHeld = 'Held on a new question';
  static const chipSlipped = 'Slipped on a new question';
  static const chipKeyHeld = 'Key being re-checked';
  static const chipCorrected = 'Key corrected';

  // The repair entry inside an opened mistake (the free part, the pick and the answer, is already above it).
  static String repairOffer(String? letter) =>
      'A repair gives you why ${letter ?? 'your answer'} looked right, why the answer is right and one rule to keep, then a new question to check it held.';
  static String repairKey(int number) => 'Repair Q$number';
  static String repairBelow(int number) => 'The Repair Q$number key below starts it.';
  static const repairedLine = 'Repaired. Your repair is saved, so opening it again costs nothing.';
  static const checkLine = 'Repaired. One new question shows whether the fix held. Your repair is saved and opens free.';

  /// The check of a repaired mistake: the same words as the foot key when the check is the next move.
  static String checkKey(int number) => 'Check Q$number held';
  static const openRepair = 'Open your repair';
  static const heldLine = 'Check it held: right. The fix held on a new question.';
  static const slippedLine = 'Check it held: not this time. It comes back in Revise.';

  // ---- The full analysis, open (v15 spec 3.1) -------------------------------------------------

  /// The heading over the open analysis.
  static const analysis = 'Your full analysis';
  static const analysisLine = 'Everything this paper shows, in the order a student reads it.';
  static const sectionAnswerSheet = 'Answer sheet';
  static const sectionMarksWent = 'Where your marks went';
  static const sectionTime = 'Time';
  static const sectionStrengths = 'Strengths and weaknesses';
  static const strengthsRead = 'What this paper showed';
  static const sectionScores = 'Scores by session';
  static const noWeakChapters = 'No chapter cost marks on this paper.';
  static const practise = 'Practise';
  static String practiseChapter(String chapter) => 'Practise $chapter';
  static String showAllChapters(int n) => 'Show all $n chapters';
  static const marksSplitTitle = 'How the marks split';

  /// The folded row of right answers under the mistakes: "28 answered right".
  static String rightRow(int n) => n == 1 ? '1 answered right' : '$n answered right';
  static String answeredRightSpoken(int n, {required bool open}) => '${rightRow(n)}. ${open ? 'Fold away' : 'Show them'}';

  // ---- Layer 4: the folds -------------------------------------------------------------------

  static const more = 'More from this paper';
  static const foldWhere = 'Where the marks went';
  static const foldTime = 'Your time and changed answers';
  static const foldPlan = 'After this mock: strengths, gaps and plan';
  static const foldProof = 'Your rule and proof it stuck';
  static String foldEvery(int n) => 'Every answer, all $n';

  static const whereCounting = 'Being counted. It is ready when the answer checks finish.';
  static String answeredRight(int right, int answered) =>
      answered == 0 ? 'Nothing was answered on this paper.' : '$right of $answered answered were right.';
  static String timeTeaser({String? median, int changes = 0}) {
    final parts = [
      ?median,
      if (changes > 0) changes == 1 ? '1 answer changed.' : '$changes answers changed.',
    ];
    return parts.isEmpty ? 'How the paper\'s time went, question by question.' : parts.join(' ');
  }

  static const planTeaserFallback = 'What went well, what cost marks, and the sets that come next.';
  static String ruleTeaser(String? rule) => rule == null ? 'No rule chosen for this mock.' : 'Your rule: $rule';
  /// The proof is on the chapter of a wrong answer, the one a repair fixes: "You went wrong on Partnership
  /// Fundamentals. Five new questions on it show whether your fix held." Two sentences, the same shape as the
  /// blank chapter's line below (copy pass, 19 Oct: the old one-sentence form read as a tangle).
  static String proveTeaser(String chapter) => 'You went wrong on $chapter. Five new questions on it show whether your fix held.';

  /// No fresh set for a wrong answer's chapter, but one for a chapter left blank: the fold says which and why, never
  /// "proof it stuck" for a chapter with nothing to repair (19 Oct walk, finding 29).
  static const foldFreshBlank = 'Five fresh questions';
  static String proveBlankTeaser(String chapter) => 'You left $chapter blank. Five new questions on it show where you stand.';
  static String everyTeaser(int right, int wrong, int blank) => '$right right, $wrong wrong, $blank blank. Tap a bubble to open its question.';
  static String rightAnswers(int n) => n == 1 ? '1 right answer' : 'Right answers ($n)';

  static String foldSpoken(String title, {required bool open}) => '$title. ${open ? 'Fold away' : 'Open'}';

  // ---- After the folds ----------------------------------------------------------------------

  static const freshTitle = 'Take another fresh paper';
  static const freshLine = 'Each paper is built new from the question bank, with no limit on how many you take.';
  static const freshKey = 'Set up a paper';
}
