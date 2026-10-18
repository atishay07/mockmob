// Which papers Today offers the reel for (D29, v15 walk M3). The card is keyed on the reel's own flag, not on
// whether the result was opened: a Quick set opens its result the moment it lands, a mock's result is often opened
// from the reveal, and each of them still owes the student one "Play your paper back".
import '../../../core/repositories/pending_result_repository.dart' show PendingResult;

/// A paper the reel card is due for: its attempt id and when its result arrived on this phone.
typedef ReelDue = ({String attemptId, DateTime receivedAt});

/// How long a paper whose result is already open stays eligible. The card is for a fresh submission; a week-old
/// paper the student read long ago is not offered a reel the day an update appears. A result that was never opened
/// stays eligible however old it is (that was always so).
const Duration reelCardWindow = Duration(hours: 24);

/// The papers to offer the reel for, newest first.
///
/// * A paper in [seen] is done.
/// * A paper whose result was never opened is due (as it always was).
/// * A paper whose result is already open is due only once the memory of what was played has been read ([seen]
///   not null, so a paper already played never flashes a card), its attempt is on the phone ([knownAttempts], so
///   the card can name it), and it arrived within [reelCardWindow] of [now].
List<ReelDue> reelPendingFrom({
  required Iterable<PendingResult> pending,
  required Set<String>? seen,
  required Set<String> knownAttempts,
  required DateTime now,
}) {
  final done = seen ?? const <String>{};
  final out = <ReelDue>[];
  for (final p in pending) {
    if (done.contains(p.attemptId)) continue;
    if (p.isOpened && (seen == null || !knownAttempts.contains(p.attemptId) || now.difference(p.receivedAt) > reelCardWindow)) continue;
    out.add((attemptId: p.attemptId, receivedAt: p.receivedAt));
  }
  out.sort((a, b) => b.receivedAt.compareTo(a.receivedAt));
  return out;
}
