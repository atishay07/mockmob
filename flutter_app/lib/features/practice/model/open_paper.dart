import '../../../core/models/session.dart' show SessionView;
import 'pending_start.dart';

/// Where an open paper is.
enum OpenPaperKind {
  /// A start whose answer the phone never saw: its key is stored, the server may hold the paper.
  pending,

  /// A durable session the server holds and this phone has no draft for.
  held,

  /// Running on this phone already (only ever the reason a second paid start waits).
  onPhone,
}

/// One open paper: enough to name it, say when it ends when that is known, and continue it.
class OpenPaper {
  const OpenPaper({
    required this.kind,
    required this.subjectId,
    required this.apiMode,
    required this.count,
    this.mockNumber,
    this.endsAt,
    this.sessionId,
    this.start,
    this.view,
  });

  final OpenPaperKind kind;

  /// The public subject id.
  final String subjectId;

  /// `full`, `nta`, `quick` or `smart`.
  final String apiMode;
  final int count;
  final int? mockNumber;

  /// When the paper's clock ends, from the server's own numbers; null for a start nobody has read yet.
  final DateTime? endsAt;

  /// The session this paper is, once known (a held paper, one running here).
  final String? sessionId;

  /// The stored start that asked for this paper, when there is one.
  final PendingStart? start;

  /// The session as the server returned it, for a held paper.
  final SessionView? view;

  bool get isMock => apiMode == 'full' || apiMode == 'nta';

  /// What a card keyed on this paper is about: it changes only when the paper does.
  String get identity => switch (kind) {
    OpenPaperKind.pending => 'pending:${start?.generationKey}',
    OpenPaperKind.held => 'held:$sessionId',
    OpenPaperKind.onPhone => 'phone:$sessionId',
  };
}
