import '../../../core/models/attempt.dart';
import 'ask_controller.dart';
import 'evidence.dart';
import 'insights_models.dart';
import 'readout.dart';

/// Where a record answer comes from, in the student's own terms: how many questions it rests on
/// and the sessions behind it, so every claim in Ask carries Show me. A reply with no session
/// behind it on this phone has no citation (and so no Show me).
class AskCitation {
  const AskCitation({required this.questions, required this.sessions});

  /// Questions the claim rests on, or null when it rests on the whole record.
  final int? questions;

  /// The sessions behind it, newest first. Empty when the phone cannot show them.
  final List<Attempt> sessions;
}

/// The citation for a record reply ([AskOrigin.phone] or [AskOrigin.record]): the finding the
/// reply opens with (the same readout the phone answers from), or the whole record when the
/// reply is not one of them. Model and paused replies never claim the record: null.
AskCitation? citationFor(AskMessage m, PrepInsights? insights, RecordEvidence? ev) {
  if (m.fromStudent || m.sending || m.failure != null) return null;
  if (m.origin != AskOrigin.phone && m.origin != AskOrigin.record) return null;
  if (insights == null || !insights.isReady) return null;

  for (final f in readout(insights, limit: 6)) {
    if (m.text.startsWith('${f.headline}.')) {
      return AskCitation(questions: f.n, sessions: ev?.forFinding(f, insights) ?? const []);
    }
  }
  if (m.text.startsWith('Last 7 days:')) {
    final from = ev?.now.subtract(const Duration(days: 7));
    return AskCitation(
      questions: insights.thisWeek.questions,
      sessions: [if (ev != null && from != null) for (final a in ev.recent) if (!a.completedAt.isBefore(from)) a],
    );
  }
  return AskCitation(questions: insights.questions, sessions: ev?.ledger ?? const []);
}
