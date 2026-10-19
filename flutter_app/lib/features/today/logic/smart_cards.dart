// The smart layer's three deck cards (SMART-LAYER-1019PM 2.4), in the deck's existing card format:
// a subject he chose and has left alone (a practice move in it, so Up next swaps the lead to it),
// "Make {m} minutes your daily goal?" and "Try a {m}-minute goal for now?" (Up next sets the goal;
// "Keep my goal" is the equal choice). Each appears only when its rule in StudyPattern held, and
// each keeps quiet for 14 days after a Not now. Plus how the deck leans: the kinds he picks rise,
// the kinds he keeps passing on sink, and his most-picked mode wins a tie.
import '../copy_pattern.dart';
import 'glance_builder.dart' show presentMove;
import 'move_builder.dart' show otherSubjectMoveFor;
import 'study_pattern.dart';
import 'subjects.dart';
import 'today_inputs.dart';
import 'today_model.dart';

/// A choice the smart layer added (it rides on top of the deck's own size).
bool isSmartChoice(MoveChoice c) => c.key == PatternCards.raise || c.key == PatternCards.fit || c.key.startsWith('untouched:');

/// The smart cards for [lead]'s deck, in the order they enter it.
List<MoveChoice> smartChoices(TodayInputs i, MoveHero lead) {
  final p = i.pattern;
  if (p == null || (i.attempts ?? const []).isEmpty) return const [];
  final out = <MoveChoice>[];
  final a = p.avoided;
  if (a != null && canonicalSubject(lead.subjectId ?? '') != a.subject) {
    final m = presentMove(otherSubjectMoveFor(i, subject: a.subject), i);
    final name = subjectName(a.subject);
    final q = int.tryParse(m.number ?? '') ?? 10;
    out.add(MoveChoice(
      key: PatternCards.untouched(a.subject),
      title: PatternCopy.untouchedTitle(name, a.days),
      line: PatternCopy.untouchedLine(name, a.days, q),
      hero: m.copyWith(title: PatternCopy.untouchedTitle(name, a.days)),
    ));
  }
  final raise = p.raise;
  final fit = p.fit;
  final goal = p.goalMinutes;
  if (raise != null) {
    out.add(MoveChoice(
      key: PatternCards.raise,
      title: PatternCopy.raiseTitle(raise.minutes),
      line: PatternCopy.raiseLine(raise.minutes, raise.days, raise.outOf),
      action: TodayAction(PatternCopy.useThisGoal, SetDailyGoal(raise.minutes)),
    ));
  } else if (fit != null && goal != null) {
    out.add(MoveChoice(
      key: PatternCards.fit,
      title: PatternCopy.fitTitle(fit.minutes),
      line: PatternCopy.fitLine(goal),
      action: TodayAction(PatternCopy.useThisGoal, SetDailyGoal(fit.minutes)),
    ));
  }
  return out;
}

/// [choices] with [smart] entered: the untouched subject at position 2, a goal card after it.
List<MoveChoice> withSmartChoices(List<MoveChoice> choices, List<MoveChoice> smart) {
  if (smart.isEmpty) return choices;
  final out = [...choices];
  var at = out.isEmpty ? 0 : 1;
  for (final c in smart) {
    if (out.any((x) => x.key == c.key)) continue;
    out.insert(at.clamp(0, out.length), c);
    at++;
  }
  return out;
}

/// The deck kind a mode's sessions belong to ("chapter" practice is the weakest-chapter card).
String? kindOfMode(String mode) => switch (mode) {
      'chapter' => 'weakest',
      'full' || 'nta' => 'mock',
      'repair' => 'repair',
      'revise' => 'revise',
      'quick' => 'other',
      'mob' => 'mob',
      _ => null,
    };

/// How the deck leans for the student of [p].
DeckLean deckLeanOf(StudyPattern? p) => p == null
    ? const DeckLean()
    : DeckLean(liked: p.likedKinds, ignored: p.ignoredKinds, preferredKind: p.preferredMode == null ? null : kindOfMode(p.preferredMode!));
