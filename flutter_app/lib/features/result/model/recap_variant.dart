import '../../../core/domain/next_move.dart' show isLateNightHour;
import '../../../core/mascot/mobi_acts.dart' show MobiAct, MobiMoves;
import '../../rhythm/rhythm.dart' show CelebrationMode;

/// The outcome variants of the recap (spec 5.6.4). The server decides tone; the app never
/// decides what is poor. Keys being unavailable is a separate flag on the model, because it
/// combines with any variant.
enum RecapVariant {
  /// No tone, or a neutral one.
  standard,

  /// The student's first full or NTA-style mock in this subject.
  firstMock,

  /// At least one answer key is withdrawn, under review or changed: no figure.
  held,

  /// `recap.tone == 'lower'`: calm, no roll, no Mobi on cards 1 and 2, no ticks.
  lower,

  /// `recap.tone == 'higher'`: the comparison, one Mobi hop after the figure lands.
  higher;

  /// The analytics value.
  String get wire => switch (this) {
    standard => 'default',
    firstMock => 'first_mock',
    held => 'held',
    lower => 'lower',
    higher => 'higher',
  };

  /// The reveal may carry its light sweep, roll and ticks. Lower and held results open with a
  /// calm fade and no celebration of any kind (brief 1.1 and 10).
  bool get celebratory => this == standard || this == firstMock || this == higher;

  /// A milestone or effort token may show. Never after a lower or held result.
  bool get allowsTokens => this != lower && this != held;
}

/// Precedence: held marks first (the figure is not final), then the first mock (nothing to
/// compare), then the server's tone.
RecapVariant resolveRecapVariant({required bool hasHeld, required int? ordinal, String? tone}) {
  if (hasHeld) return RecapVariant.held;
  if (ordinal == 1) return RecapVariant.firstMock;
  return switch (tone) {
    'lower' => RecapVariant.lower,
    'higher' => RecapVariant.higher,
    _ => RecapVariant.standard,
  };
}

/// A line Mobi may say with its reaction. An id, not text: the screen looks the words up in the
/// feature's copy, so the table stays pure and the words stay in one place.
enum RecapLineId {
  /// Late at night, after the recap: "Goodnight".
  goodnight,
}

/// What Mobi does when the recap or the result reaches a moment, and the one line it may say.
class RecapReaction {
  const RecapReaction(this.act, {this.line});

  final MobiAct act;
  final RecapLineId? line;

  /// How long the act runs, in milliseconds.
  int get actMillis => (MobiMoves.duration(act) * 1000).round();

  @override
  bool operator ==(Object other) => other is RecapReaction && other.act == act && other.line == line;

  @override
  int get hashCode => Object.hash(act, line);

  @override
  String toString() => 'RecapReaction($act${line == null ? '' : ', $line'})';
}

/// The one reaction table of the recap and the result (the card 4 Mobi, the sheet's Mobi, the
/// finish screen and the full result's Mobi all read it, so Mobi never contradicts itself between
/// screens):
///
///  * NTA mode: nothing. The exam is exam-faithful, so no Mobi and no celebration follows it.
///  * Late at night (11 PM to 5 AM, the shared window): sleepy, and "Goodnight".
///  * The first full mock: proud. A higher result: cheer. A lower or held result: encourage (a
///    warm nod, never a frown). Anything else: rest.
///  * Celebrations on Quiet or Off turns proud and cheer into rest: Mobi sits, it does not act
///    out a celebration.
///
/// [hour] is the local hour, 0 to 23.
RecapReaction? recapReaction({
  required RecapVariant variant,
  required CelebrationMode mode,
  required bool isNta,
  required int hour,
}) {
  if (isNta) return null;
  if (isLateNightHour(hour)) return const RecapReaction(MobiAct.sleepy, line: RecapLineId.goodnight);
  final full = mode == CelebrationMode.full;
  return switch (variant) {
    RecapVariant.firstMock => RecapReaction(full ? MobiAct.proud : MobiAct.rest),
    RecapVariant.higher => RecapReaction(full ? MobiAct.cheer : MobiAct.rest),
    RecapVariant.lower || RecapVariant.held => const RecapReaction(MobiAct.encourage),
    RecapVariant.standard => const RecapReaction(MobiAct.rest),
  };
}

/// How long the finish screen holds before Today takes over: the act's length plus 900 ms for the
/// line to be read, never under 2 seconds. With no reaction (NTA) or a held pose under reduced
/// motion, the plain 2.2 seconds it always had.
Duration recapFinishHold(RecapReaction? reaction, {required bool reduced}) {
  if (reaction == null || reduced) return const Duration(milliseconds: 2200);
  final ms = reaction.actMillis + 900;
  return Duration(milliseconds: ms < 2000 ? 2000 : ms);
}
