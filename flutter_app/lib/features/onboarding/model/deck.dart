import '../data/warmup_pool.dart';
import 'answers.dart';

/// How a step asks (directions-final 0.6). The flow maps each kind to its screen.
enum StepKind { single, ladder, confidence, choice, check, rhythm, reveal, account, firstMove }

/// One row of the versioned step deck. Every step must say what visibly changes now and where
/// it pays off later; a test fails if either is empty.
class DeckStep {
  const DeckStep({
    required this.id,
    required this.kind,
    required this.bubble,
    required this.writes,
    required this.changesNow,
    required this.paysOffLater,
    this.skippable = true,
    this.onSheet = true,
    this.when,
  });

  final String id;
  final StepKind kind;

  /// The label of its bubble on the answer sheet ("CUET", "Aim").
  final String bubble;

  /// The fields it writes.
  final List<String> writes;
  final String changesNow;
  final String paysOffLater;
  final bool skippable;

  /// False for steps after the sheet is sealed (save, first move), which have no bubble.
  final bool onSheet;

  /// The branch rule: shown only when this returns true (always when null).
  final bool Function(OnboardingAnswers answers)? when;

  bool visibleFor(OnboardingAnswers a) => when?.call(a) ?? true;
}

/// Step ids, used by the store and the screens.
abstract final class Steps {
  static const String stage = 'stage';
  static const String course = 'course';
  static const String subjects = 'subjects';
  static const String worry = 'worry';
  static const String question = 'question';
  static const String rhythm = 'rhythm';
  static const String plan = 'plan';
  static const String save = 'save';
  static const String firstMove = 'firstMove';
}

class OnboardingDeck {
  const OnboardingDeck({required this.version, required this.steps});

  final int version;
  final List<DeckStep> steps;

  /// The steps with a bubble on the sheet, in order.
  List<DeckStep> get sheetSteps => [for (final s in steps) if (s.onSheet) s];

  List<DeckStep> visible(OnboardingAnswers a) => [for (final s in steps) if (s.visibleFor(a)) s];

  DeckStep? byId(String? id) {
    for (final s in steps) {
      if (s.id == id) return s;
    }
    return null;
  }
}

/// "Your sheet": about two minutes, every step from stage to rhythm skippable.
final OnboardingDeck kOnboardingDeck = OnboardingDeck(
  version: 1,
  steps: [
    const DeckStep(
      id: Steps.stage,
      kind: StepKind.single,
      bubble: 'CUET',
      writes: ['stage'],
      changesNow: 'The weeks to the expected May window roll onto the sheet.',
      paysOffLater: 'Plan length, the board-season taper and the countdown on Today.',
    ),
    const DeckStep(
      id: Steps.course,
      kind: StepKind.ladder,
      bubble: 'Aim',
      writes: ['courseId', 'colleges', 'category', 'openToAny', 'courseUndecided'],
      changesNow: 'The college ladder with Round 1 minimum scores, 2026; picks engrave onto the sheet.',
      paysOffLater: 'The dream ladder on Today and in You; the eligibility line on the next step.',
    ),
    const DeckStep(
      id: Steps.subjects,
      kind: StepKind.confidence,
      bubble: 'Subjects',
      writes: ['subjects', 'confidence'],
      changesNow: 'Rows reorder weakest first and the eligibility line updates.',
      paysOffLater: 'The subject of the first check and the gut-versus-check card in the first recap.',
    ),
    const DeckStep(
      id: Steps.worry,
      kind: StepKind.choice,
      bubble: 'Marks',
      writes: ['worry'],
      changesNow: 'The first move on the sheet rewrites itself and Mobi says one line.',
      paysOffLater: 'The first check\'s subject and framing, and the first week\'s repairs.',
    ),
    DeckStep(
      id: Steps.question,
      kind: StepKind.check,
      bubble: 'Try',
      writes: const ['warmup'],
      changesNow: 'A right answer shows its measured time; a wrong one shows the ten-second fix.',
      paysOffLater: 'A first taste of repair, which is what the plan is built on.',
      when: (a) => a.ranked.any(warmupSubjects.contains) || a.subjects.isEmpty,
    ),
    const DeckStep(
      id: Steps.rhythm,
      kind: StepKind.rhythm,
      bubble: 'Pace',
      writes: ['minutes', 'days', 'window'],
      changesNow: 'The number of sessions before May recounts live.',
      paysOffLater: 'The week row on Today, the weekly goal and the study window on the account.',
    ),
    const DeckStep(
      id: Steps.plan,
      kind: StepKind.reveal,
      bubble: 'Plan',
      writes: ['sealedAt'],
      changesNow: 'The sheet flips and the plan engraves line by line; holding seals it.',
      paysOffLater: 'The plan Today opens with.',
      skippable: false,
    ),
    const DeckStep(
      id: Steps.save,
      kind: StepKind.account,
      bubble: 'Save',
      writes: ['age', 'notNow'],
      changesNow: 'The account buttons appear once age is answered; saved shows only after the server says so.',
      paysOffLater: 'The sheet follows the student to mockmob.in and any phone.',
      skippable: false,
      onSheet: false,
    ),
    DeckStep(
      id: Steps.firstMove,
      kind: StepKind.firstMove,
      bubble: 'Start',
      writes: const ['tonight'],
      changesNow: 'The starting-point check, ready to start or set for tonight.',
      paysOffLater: 'The first real result, which ends the first run.',
      skippable: false,
      onSheet: false,
      when: (a) => a.notNow,
    ),
  ],
);
