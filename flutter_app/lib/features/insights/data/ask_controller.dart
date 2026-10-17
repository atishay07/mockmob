import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/repositories/local_scope.dart';
import '../../../core/storage/prefs_store.dart';
import 'ai_reply_report.dart';
import 'ask_question.dart';
import 'ask_wallet.dart';
import 'insights_repository.dart';
import 'readout.dart';

/// Where a reply came from. Each says what it cost.
enum AskOrigin {
  /// Computed on this phone from the record. Free.
  phone,

  /// The server answered from the record. Free.
  record,

  /// A model reply through the server's budget guard. 1 credit.
  model,

  /// Model replies are paused; the server explained the next step instead. Free.
  paused,
}

/// Why a question did not get a reply, one per server outcome of `POST /api/ai/mentor/chat`
/// (`runModelReply` in src/services/prepos/modelReply.js). None of them costs a credit: the
/// server sends `charged: 0` and releases what it reserved.
enum AskFailure {
  /// No answer arrived. The outcome is unknown, so Send again reuses the request id and the server
  /// never charges the same question twice.
  offline,

  /// `insufficient_ai_credits` (402): the wallet has no credit for a reply.
  noCredits,

  /// `paused` (503): AI replies are switched off for now.
  paused,

  /// `operation_released` (409): that attempt was released. Send again goes with a fresh id.
  resend,
  rateLimited,
  tooLong,

  /// The reply service failed (`could_not_start`, `provider_error`, `unusable_output`, ...).
  unavailable,

  /// `in_progress` (409): the same question is still being answered. Send again asks for it.
  inProgress,

  /// `duplicate` (409): the question was answered and charged, but the reply did not reach this
  /// phone and could not be read back from the conversation history.
  alreadyAnswered,

  /// `budget_reached` (503): this month's AI budget is used up until the 1st.
  budgetReached,

  /// `wallet_unavailable` (503): the credit wallet could not be reached; nothing was reserved.
  walletUnavailable,

  /// The app was closed or killed while a model question was on its way. The server may already
  /// have answered and charged; sending it again reuses the same request id, so it is not
  /// charged twice.
  interrupted,
}

class AskMessage {
  const AskMessage.student(this.text)
      : fromStudent = true,
        origin = null,
        actions = const [],
        sending = false,
        failure = null,
        balance = null,
        retryText = null,
        questionRef = null,
        requestId = null,
        charged = null,
        left = null,
        creditHeld = false;

  /// [charged] and [left] are what the server reported with the reply: the credits it took and
  /// the balance right after. Null when the server did not say.
  const AskMessage.reply(this.text, {required AskOrigin this.origin, this.actions = const [], this.requestId, this.charged, this.left})
      : fromStudent = false,
        sending = false,
        failure = null,
        retryText = null,
        questionRef = null,
        balance = null,
        creditHeld = false;

  const AskMessage.sending()
      : fromStudent = false,
        text = '',
        origin = null,
        actions = const [],
        sending = true,
        failure = null,
        balance = null,
        retryText = null,
        questionRef = null,
        requestId = null,
        charged = null,
        left = null,
        creditHeld = false;

  /// [retryText] and [requestId] are the question this failure belongs to, so Send again on any
  /// failed bubble sends that bubble's own question.
  const AskMessage.failed(AskFailure this.failure, {this.balance, this.retryText, this.requestId, this.questionRef, this.creditHeld = false})
      : fromStudent = false,
        text = '',
        origin = null,
        actions = const [],
        sending = false,
        charged = null,
        left = null;

  final bool fromStudent;
  final String text;
  final AskOrigin? origin;

  /// (label, href) pairs. The screen maps hrefs to app routes and hides what it cannot open.
  final List<(String, String)> actions;
  final bool sending;
  final AskFailure? failure;

  /// Credits the server said the student has, on [AskFailure.noCredits].
  final int? balance;

  /// The request that produced a server reply, so a report names exactly that reply. On a
  /// failure, the request to send again.
  final String? requestId;

  /// On a failure: the question to send again.
  final String? retryText;

  /// On a failure: the handed-over question (`<attemptId>:<questionId>`) the message was about, so
  /// Send again goes with the same one. Null for an ordinary message.
  final String? questionRef;

  /// Credits the server took for this reply: 1, 0 (nothing was charged) or null (not reported).
  final int? charged;

  /// The balance the server reported right after this reply, or null when it did not say.
  final int? left;

  /// On a failure: the server could not release the reserved credit at once. It is held briefly
  /// and returns by itself (the server's own words), so the line does not say "not charged" yet.
  final bool creditHeld;

  /// Written by a model: carries the "can be wrong" line and Report this reply.
  bool get isModel => origin == AskOrigin.model;
}

class AskState {
  const AskState({this.messages = const [], this.sessionId, this.wallet, this.walletAt});

  final List<AskMessage> messages;
  final String? sessionId;

  /// The wallet the latest server answer reported (a reply's `usageSnapshot`, or the balance a
  /// refusal named), and when. Fresher than the credits read until that read runs again.
  final AskWallet? wallet;
  final DateTime? walletAt;

  bool get busy => messages.any((m) => m.sending);
}

/// The longest message the server accepts.
const askMaxChars = 1500;

/// Ask your record. Questions about marks, chapters, timing or the week are answered on the
/// phone from the record (free, works offline). Anything else goes to `POST /api/ai/mentor/chat`,
/// whose budget guard decides: a free record answer, a paused notice, or a 1-credit reply.
class AskController extends Notifier<AskState> {
  // Bumped when the conversation is cleared (another student), so a late reply cannot land in it.
  int _epoch = 0;

  @override
  AskState build() {
    ref.watch(authSnapshotProvider.select((s) => s.userId));
    _epoch++;
    return const AskState();
  }

  /// The reply style the server writes in (`mentor`, `revision` for a question, `autopsy` for a
  /// mock). The full Ask screen always talks as the mentor; the Ask Mobi sheet follows its context.
  String get replyMode => 'mentor';

  /// The question handed over to this conversation, if any. The Ask screen reads its own; the Ask
  /// Mobi sheet reads the one it was opened with.
  AskQuestionHand? readHand() => ref.read(askQuestionProvider);

  /// True when [raw] is answered on the phone from the record, so nothing leaves the phone.
  bool answersOnPhone(String raw) {
    final text = raw.trim();
    if (text.isEmpty || text.length > askMaxChars) return true;
    // A record answer cannot discuss a question: with one handed over, every message goes to Mobi.
    if (readHand()?.ready ?? false) return false;
    final insights = ref.read(insightsRepositoryProvider).value;
    return insights != null && answerFromInsights(text, insights, pro: ref.read(insightsProProvider)) != null;
  }

  /// Sends [raw]. Returns the failure the question ended in, or null when it was answered. The
  /// student's bubble stays in the thread whatever happens, so the question never disappears.
  Future<AskFailure?> send(String raw) async {
    final text = raw.trim();
    if (text.isEmpty || state.busy) return null;
    if (text.length > askMaxChars) {
      _append([AskMessage.student(text), const AskMessage.failed(AskFailure.tooLong)]);
      return AskFailure.tooLong;
    }
    final hand = readHand();
    // The question is still being opened: nothing is sent, because a reply sent now would go
    // without it and still cost a credit. The words stay in the field.
    if (hand != null && hand.loading) return null;
    final questionRef = hand != null && hand.ready ? hand.ref : null;
    final insights = ref.read(insightsRepositoryProvider).value;
    final local = questionRef != null || insights == null ? null : answerFromInsights(text, insights, pro: ref.read(insightsProProvider));
    if (local != null) {
      _append([AskMessage.student(text), AskMessage.reply(local.reply, origin: AskOrigin.phone, actions: local.actions)]);
      return null;
    }
    _append([AskMessage.student(text), const AskMessage.sending()]);
    return _post(state.messages.length - 1, text, const Uuid().v4(), questionRef: questionRef);
  }

  /// A suggested ask whose answer was already read from the record on this phone ([answer]): it
  /// lands at once, free, and nothing leaves the phone. Ignored while a reply is on its way.
  void answerLocally(String question, RecordAnswer answer) {
    final text = question.trim();
    if (text.isEmpty || state.busy) return;
    _append([AskMessage.student(text), AskMessage.reply(answer.reply, origin: AskOrigin.phone, actions: answer.actions)]);
  }

  /// Sends a failed message again: the one at [index], or the last message. After an unknown
  /// outcome the same request id goes, so a reply that did arrive is never charged twice. Only
  /// that bubble changes; later turns stay as they are.
  Future<AskFailure?> retry([int? index]) async {
    final i = index ?? state.messages.length - 1;
    if (state.busy || i < 0 || i >= state.messages.length) return null;
    final failed = state.messages[i];
    final text = failed.retryText;
    if (failed.failure == null || text == null) return null;
    _replaceAt(i, const AskMessage.sending());
    return _post(i, text, failed.requestId ?? const Uuid().v4(), questionRef: failed.questionRef);
  }

  // ---- A question in flight survives the app being killed ----------------------------------

  static const _pendingKey = 'ask_pending_request';

  /// How long a remembered question is still offered again.
  static const _pendingFor = Duration(hours: 24);

  Future<void> _remember(PrefsStore store, String text, String requestId, String? questionRef) async {
    try {
      await store.setString(
        _pendingKey,
        jsonEncode({
          'text': text,
          'requestId': requestId,
          'questionRef': ?questionRef,
          'userId': ref.read(userIdProvider),
          'sessionId': state.sessionId,
          'at': ref.read(nowProvider)().toUtc().toIso8601String(),
        }),
      );
    } on Object {
      // Without the note the worst case is what happened before: the question is lost.
    }
  }

  Future<void> _forget(PrefsStore store) async {
    try {
      await store.remove(_pendingKey);
    } on Object {
      // A stale note expires by itself.
    }
  }

  /// Call when Ask opens: if a model question was on its way when the app closed, it comes back as
  /// a failed bubble with Send again, which reuses the request id the server already knows. The
  /// credit may have been charged already; the server's dedupe means sending again does not
  /// charge twice. Another account's question, an old one and a thread that has already started
  /// are left alone.
  Future<void> restoreInterrupted() async {
    if (state.messages.isNotEmpty) return;
    final epoch = _epoch;
    final owner = ref.read(userIdProvider);
    if (owner == null) return;
    final store = ref.read(insightsPrefsStoreProvider);
    final now = ref.read(nowProvider)();
    try {
      final raw = await store.getString(_pendingKey);
      if (raw == null) return;
      final j = jsonDecode(raw);
      if (j is! Map) return _forget(store);
      final text = j['text'];
      final requestId = j['requestId'];
      final at = DateTime.tryParse('${j['at']}');
      if (text is! String || text.isEmpty || requestId is! String || requestId.isEmpty) return _forget(store);
      if (at == null || now.difference(at) > _pendingFor) return _forget(store);
      if (j['userId'] != owner) return;
      if (epoch != _epoch || !ref.mounted || state.messages.isNotEmpty) return;
      state = AskState(
        messages: [
          AskMessage.student(text),
          AskMessage.failed(AskFailure.interrupted, retryText: text, requestId: requestId, questionRef: cleanQuestionRef(j['questionRef'] is String ? j['questionRef'] as String : null)),
        ],
        sessionId: j['sessionId'] is String ? j['sessionId'] as String : null,
      );
    } on Object {
      // Nothing to bring back.
    }
  }

  Future<AskFailure?> _post(int index, String text, String requestId, {String? questionRef}) async {
    final epoch = _epoch;
    final store = ref.read(insightsPrefsStoreProvider);
    await _remember(store, text, requestId, questionRef);
    try {
      final res = await ref.read(apiClientProvider).post('/api/ai/mentor/chat', body: {
        'message': text,
        'mode': replyMode,
        'requestId': requestId,
        'sessionId': ?state.sessionId,
        // The server builds the question's context itself from the student's own attempt.
        'questionRef': ?questionRef,
      });
      final body = res.map;
      final origin = switch (asString(body['origin'])) {
        'model' => AskOrigin.model,
        'status' => AskOrigin.paused,
        _ => AskOrigin.record,
      };
      await _forget(store);
      if (epoch != _epoch || !ref.mounted) return null;
      final wallet = AskWallet.fromSnapshot(body['usageSnapshot']);
      _replaceAt(
        index,
        AskMessage.reply(
          asStringOr(body['reply'], ''),
          origin: origin,
          actions: _actions(body['actions']),
          requestId: requestId,
          // Only a model reply can cost a credit, and only the server's charge says what it took.
          charged: origin == AskOrigin.model ? asInt(asJson(body['charge'])['amount']) : 0,
          left: wallet?.total,
        ),
        sessionId: asString(body['sessionId']),
        wallet: wallet,
      );
      if (origin == AskOrigin.model) ref.read(creditsRepositoryProvider.notifier).refresh();
      return null;
    } on ApiError catch (e) {
      final failure = askFailureFor(e);
      // Only an unknown outcome stays remembered: every other failure is the server saying what
      // happened to the question, so there is nothing to recover.
      if (failure != AskFailure.offline && failure != AskFailure.inProgress) await _forget(store);
      if (epoch != _epoch) return failure;
      if (failure == AskFailure.alreadyAnswered) {
        // Answered and charged once already: read that reply back instead of asking again.
        final recovered = await _recover(requestId);
        if (epoch != _epoch || !ref.mounted) return null;
        if (recovered != null) {
          _replaceAt(index, recovered);
          ref.read(creditsRepositoryProvider.notifier).refresh();
          return null;
        }
      }
      // "Did not go through", or answered already: a fresh id. Anything uncertain keeps the id.
      final next = failure == AskFailure.resend || failure == AskFailure.alreadyAnswered ? const Uuid().v4() : requestId;
      final balance = asInt(e.details['balance']);
      final base = state.wallet ?? _readWallet();
      _replaceAt(
        index,
        AskMessage.failed(
          failure,
          balance: balance,
          retryText: text,
          requestId: next,
          questionRef: questionRef,
          creditHeld: e.serverMessage?.contains('held briefly') ?? false,
        ),
        // A refusal for credits names the balance, so the header shows it at once.
        wallet: failure == AskFailure.noCredits && balance != null ? (base ?? const AskWallet()).withTotal(balance) : null,
      );
      if (failure == AskFailure.noCredits) ref.read(creditsRepositoryProvider.notifier).refresh();
      return failure;
    }
  }

  /// The reply to [requestId] read back from the conversation history (`GET
  /// /api/ai/mentor/history`), where the server stored it with its charge (the charge's reference
  /// ends with the request id). Null when it is not there or the history cannot be read.
  Future<AskMessage?> _recover(String requestId) async {
    try {
      final res = await ref.read(apiClientProvider).get('/api/ai/mentor/history', query: {'sessionId': ?state.sessionId});
      for (final m in asJsonList(res.map['messages']).reversed) {
        if (asString(m['role']) != 'assistant') continue;
        final response = asJson(m['response']);
        final charge = asJson(response['charge']);
        if (!(asString(charge['reference']) ?? '').endsWith(':$requestId')) continue;
        final text = asString(m['text']) ?? asString(response['reply']) ?? '';
        if (text.trim().isEmpty) return null;
        return AskMessage.reply(
          text,
          origin: AskOrigin.model,
          actions: _actions(response['actions']),
          requestId: requestId,
          charged: asInt(charge['amount']),
        );
      }
    } on Object {
      // The history could not be read: the failure line says what happened instead.
    }
    return null;
  }

  static List<(String, String)> _actions(Object? raw) => [
        for (final a in asJsonList(raw))
          if (asString(a['label']) case final label? when asString(a['route']) != null) (label, asString(a['route'])!),
      ];

  AskWallet? _readWallet() {
    final c = ref.read(creditsRepositoryProvider).value;
    return c == null ? null : AskWallet.fromCredits(c);
  }

  void _append(List<AskMessage> add) =>
      state = AskState(messages: [...state.messages, ...add], sessionId: state.sessionId, wallet: state.wallet, walletAt: state.walletAt);

  void _replaceAt(int index, AskMessage m, {String? sessionId, AskWallet? wallet}) {
    if (!ref.mounted || index >= state.messages.length) return;
    final next = [...state.messages]..[index] = m;
    state = AskState(
      messages: next,
      sessionId: sessionId ?? state.sessionId,
      wallet: wallet ?? state.wallet,
      walletAt: wallet != null ? ref.read(nowProvider)() : state.walletAt,
    );
  }
}

final askControllerProvider = NotifierProvider<AskController, AskState>(AskController.new);

/// The failure a refused or lost question ends in. The server's machine code decides first (the
/// codes the website and the repair route share); the HTTP status only for a code it has not met.
AskFailure askFailureFor(ApiError e) {
  if (e.isOffline) return AskFailure.offline;
  return switch (e.code.toLowerCase()) {
    'insufficient_ai_credits' => AskFailure.noCredits,
    'operation_released' => AskFailure.resend,
    'in_progress' => AskFailure.inProgress,
    'duplicate' => AskFailure.alreadyAnswered,
    'paused' || 'prepos_paused' => AskFailure.paused,
    'budget_reached' => AskFailure.budgetReached,
    'wallet_unavailable' || 'ai_credit_rpc_unavailable' => AskFailure.walletUnavailable,
    'message_too_long' || 'payload_too_large' => AskFailure.tooLong,
    'could_not_start' || 'provider_error' || 'provider_timeout' || 'provider_unavailable' || 'unusable_output' || 'empty_reply' || 'reserve_failed' =>
      AskFailure.unavailable,
    _ => switch (e.kind) {
        ApiErrorKind.paymentRequired => AskFailure.noCredits,
        ApiErrorKind.conflict => AskFailure.resend,
        ApiErrorKind.rateLimited => AskFailure.rateLimited,
        ApiErrorKind.payloadTooLarge => AskFailure.tooLong,
        _ => AskFailure.unavailable,
      },
  };
}

/// The wallet Ask shows: the latest the server reported, from a chat answer or from the credits
/// read, whichever is newer. Null until either has arrived.
final askWalletProvider = Provider<AskWallet?>((ref) {
  final (fromAsk, askAt) = ref.watch(askControllerProvider.select((s) => (s.wallet, s.walletAt)));
  return freshestAskWallet(ref, fromAsk, askAt);
});

/// The newer of a chat answer's wallet ([fromAsk], reported at [askAt]) and the credits read.
AskWallet? freshestAskWallet(Ref ref, AskWallet? fromAsk, DateTime? askAt) {
  final read = ref.watch(creditsRepositoryProvider);
  final fromRead = read.value == null ? null : AskWallet.fromCredits(read.value!);
  if (fromAsk == null) return fromRead;
  if (fromRead == null) return fromAsk;
  final readAt = read.fetchedAt;
  // A network read that finished after the chat answer is the newer truth.
  return readAt != null && !read.fromCache && askAt != null && readAt.isAfter(askAt) ? fromRead : fromAsk;
}
