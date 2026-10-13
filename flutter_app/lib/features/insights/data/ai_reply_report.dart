import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';
import '../../../core/sync/outbox_repository.dart';
import '../../../core/sync/sync_providers.dart';

/// Where a report about an AI reply goes. The server does not have this endpoint yet (see the
/// package report): until it does, a report is kept in the outbox, the flush gets a 404, and the
/// student is told it did not reach us. Never a false "Reported".
const String aiReplyReportPath = '/api/ai/mentor/report';

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
final insightsPrefsStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

const String _aiDisclosedKey = 'ask_ai_service_disclosed';

/// True once the student has been told, before a first model call, that such a message goes to
/// an AI service. A failed read counts as not told, so the notice errs toward showing.
Future<bool> aiServiceDisclosed(PrefsStore store) async {
  try {
    return await store.getBool(_aiDisclosedKey) ?? false;
  } on Object {
    return false;
  }
}

Future<void> markAiServiceDisclosed(PrefsStore store) async {
  try {
    await store.setBool(_aiDisclosedKey, true);
  } on Object {
    // The worst case is the notice once more.
  }
}
