import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';

/// "Ask Mobi about Q3": the mistake Ask was handed from a repair (`/ask?q=<attemptId>:<questionId>`).
///
/// The server builds what Mobi sees from the student's own attempt (the question text, its options,
/// the student's pick, today's key and the repair's rule); the app sends only the reference. Ask's
/// own credit rules apply: one AI credit, said before sending. A record answer cannot discuss a
/// question, so while a question is handed over nothing is answered on the phone.

/// `<attemptId>:<questionId>`, the shape the server accepts (ids of letters, digits, `_` and `-`).
final RegExp _ref = RegExp(r'^[A-Za-z0-9_-]{1,100}:[A-Za-z0-9_-]{1,100}$');

/// The reference for a question, or null when it is not one the server would accept.
String? cleanQuestionRef(String? raw) {
  final t = raw?.trim();
  return t != null && _ref.hasMatch(t) ? t : null;
}

/// `GET /api/recovery/ask-context`: the context line of the Ask screen.
class AskQuestionContext {
  const AskQuestionContext({required this.question, this.subject, this.chapter, this.rule, this.pickLetter, this.hasKey = true, this.credits});

  /// Null when the body has no question text: nothing to show means nothing is handed over.
  static AskQuestionContext? tryParse(Object? body) {
    if (body is! Map) return null;
    final j = asJson(body);
    if (j['ok'] != true || j['context'] is! Map) return null;
    final c = asJson(j['context']);
    String? text(Object? v) {
      final s = asString(v)?.trim();
      return s == null || s.isEmpty ? null : s;
    }

    final question = text(c['question']);
    if (question == null) return null;
    final pick = c['pick'] is Map ? text(asJson(c['pick'])['letter']) : null;
    final cost = c['cost'] is Map ? asInt(asJson(c['cost'])['credits']) : null;
    return AskQuestionContext(
      question: question,
      subject: text(c['subject']),
      chapter: text(c['chapter']),
      rule: text(c['rule']),
      pickLetter: pick,
      hasKey: asBool(c['hasKey']) ?? true,
      credits: cost,
    );
  }

  /// The question's first 160 characters (cut by the server).
  final String question;
  final String? subject;
  final String? chapter;

  /// The repair's rule, or null.
  final String? rule;

  /// The letter of the option the student picked, when the server says it.
  final String? pickLetter;

  /// False while the key is being re-checked: Mobi will not name an answer.
  final bool hasKey;

  /// What a reply costs, from the server (1).
  final int? credits;
}

enum AskQuestionStatus { loading, ready, error }

/// The question Ask was handed, while it is being opened, once it is open, or when it could not be.
class AskQuestionHand {
  const AskQuestionHand({required this.ref, required this.status, this.context, this.message});

  final String ref;
  final AskQuestionStatus status;
  final AskQuestionContext? context;

  /// The line for an error.
  final String? message;

  bool get loading => status == AskQuestionStatus.loading;
  bool get ready => status == AskQuestionStatus.ready;
}

/// "That question could not be opened."
const askQuestionOpenFailed = 'That question could not be opened.';

/// The handed-over question. Null when Ask was opened without one (or the student dropped it).
class AskQuestionController extends Notifier<AskQuestionHand?> {
  int _turn = 0;

  @override
  AskQuestionHand? build() {
    ref.watch(authSnapshotProvider.select((s) => s.userId));
    return null;
  }

  /// Hands [raw] to Ask: reads its context. A reference the server would not accept, or one that is
  /// already open, changes nothing. While it is being opened nothing is sent: a reply sent now would
  /// go without it and still cost a credit.
  Future<void> open(String? raw) async {
    final qref = cleanQuestionRef(raw);
    if (qref == null) return;
    final now = state;
    if (now != null && now.ref == qref && now.status != AskQuestionStatus.error) return;
    final turn = ++_turn;
    state = AskQuestionHand(ref: qref, status: AskQuestionStatus.loading);
    AskQuestionHand next;
    try {
      final res = await ref.read(apiClientProvider).get('/api/recovery/ask-context', query: {'q': qref});
      final ctx = AskQuestionContext.tryParse(res.data);
      next = ctx == null
          ? AskQuestionHand(ref: qref, status: AskQuestionStatus.error, message: askQuestionOpenFailed)
          : AskQuestionHand(ref: qref, status: AskQuestionStatus.ready, context: ctx);
    } on ApiError {
      next = AskQuestionHand(ref: qref, status: AskQuestionStatus.error, message: askQuestionOpenFailed);
    }
    if (!ref.mounted || turn != _turn) return;
    state = next;
  }

  /// Ask opened without a question: nothing is handed over.
  void clear() {
    _turn++;
    if (state != null) state = null;
  }
}

final askQuestionProvider = NotifierProvider<AskQuestionController, AskQuestionHand?>(AskQuestionController.new);
