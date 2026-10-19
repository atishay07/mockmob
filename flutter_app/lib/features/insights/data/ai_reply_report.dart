import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';
import '../../../core/sync/outbox_repository.dart';
import '../../../core/sync/sync_providers.dart';

/// Where a report about an AI reply goes. The server does not have this endpoint yet: a report
/// would be kept in the outbox, the flush would get a 404 and the student would be told it did
/// not reach us, every time. So the Report key is not shown at all until the endpoint is live
/// (see [aiReplyReportAvailableProvider]). Never a false "Reported", and never a control that is
/// known to fail.
const String aiReplyReportPath = '/api/ai/mentor/report';

/// Flip to true in the build that ships with `POST /api/ai/mentor/report` on the server. Until
/// then Ask shows no Report key.
const bool aiReplyReportLive = true;

/// Whether the Report this reply key is shown. Tests replace it.
final aiReplyReportAvailableProvider = Provider<bool>((ref) => aiReplyReportLive);

/// The outbox kind of a reply report.
const String aiReplyReportKind = 'ai_reply_report';

enum ReplyReportOutcome {
  /// The server acknowledged it.
  sent,

  /// Kept on this phone; sent when the network is back.
  waiting,

  /// The server refused it for good.
  failed,
}

/// Reports one AI reply: stored in the outbox first (so a dropped connection keeps it), then
/// sent at once when online. The same reply reported twice is one report (the key comes from
/// the reply's request id).
Future<ReplyReportOutcome> reportAiReply(
  SyncCoordinator sync, {
  required String reason,
  required String reply,
  String? sessionId,
  String? requestId,
}) async {
  final excerpt = reply.length > 1200 ? reply.substring(0, 1200) : reply;
  final OutboxItem item = await sync.repository.enqueue(
    kind: aiReplyReportKind,
    method: 'POST',
    path: aiReplyReportPath,
    idempotencyKey: requestId == null ? null : 'ai-report-$requestId',
    body: {
      'reason': reason,
      'reply': excerpt,
      'sessionId': ?sessionId,
      'requestId': ?requestId,
    },
  );
  final results = await sync.flushNow();
  for (final r in results) {
    if (r.item.id != item.id) continue;
    return switch (r.kind) {
      OutboxResultKind.sent => ReplyReportOutcome.sent,
      OutboxResultKind.dropped => ReplyReportOutcome.failed,
      OutboxResultKind.retryLater || OutboxResultKind.conflict => ReplyReportOutcome.waiting,
    };
  }
  return ReplyReportOutcome.waiting;
}

/// The insights feature's own per-phone flags.
final insightsPrefsStoreProvider = Provider<PrefsStore>((ref) {
  try {
    return SharedPrefsStore();
  } on Object {
    // No platform store (a test, a background isolate without the plugin): flags and the
    // remembered question live for this run only, which is the worst case the callers expect.
    return MemoryPrefsStore();
  }
});
