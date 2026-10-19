import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import '../../../core/connectivity/connectivity_providers.dart' show networkStatusProvider;
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/repositories/local_scope.dart';
import '../../../core/storage/prefs_store.dart';
import 'ai_reply_report.dart';
import 'ask_question.dart';
import 'ask_wallet.dart';
import 'insights_models.dart' show PrepInsights;
import '../widgets/ask_prompts.dart' show moreRecordPrompts, recordPrompts;
import 'insights_repository.dart';
import 'mobi_api.dart';
import 'mobi_models.dart';
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

  /// No answer arrived in time while the phone is online (the server is slow, not the phone
  /// offline). The outcome is unknown, as with [offline]: Send again reuses the request id.
  slow,

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

  /// `thread_full` (409): this doubt has had its follow-up. Nothing was charged; a new doubt opens a new thread.
  threadFull,

  /// `thread_not_found` (404): the doubt's thread is gone. Nothing was charged.
  threadGone,

  /// The app was closed or killed while a model question was on its way. The server may already
  /// have answered and charged; sending it again reuses the same request id, so it is not
  /// charged twice.
  interrupted,
}

/// What a message is sent with beside its words (MOBI-CONTRACT 2): the thread it follows up, the subject and chapter
/// its 2 check questions come from, or `tonight` for the free record plan. Kept on a failure and on the pending
/// note, so Send again goes as the same kind of message (a follow-up never comes back as a paid doubt).
class AskAnchor {
  const AskAnchor({this.threadId, this.subject, this.chapter, this.replyKind});

  final String? threadId;
  final String? subject;
  final String? chapter;
  final String? replyKind;

  bool get isFollowUp => threadId != null;

  Map<String, Object?> toJson() => {'threadId': ?threadId, 'subject': ?subject, 'chapter': ?chapter, 'replyKind': ?replyKind};

  static AskAnchor? fromJson(Object? v) {
    if (v is! Map) return null;
    String? t(Object? x) => x is String && x.trim().isNotEmpty ? x.trim() : null;
    final a = AskAnchor(threadId: t(v['threadId']), subject: t(v['subject']), chapter: t(v['chapter']), replyKind: t(v['replyKind']));
    return a.threadId == null && a.subject == null && a.chapter == null && a.replyKind == null ? null : a;
  }
}

/// The reply kind that asks the server for tonight's revise plan from the record (free, no model).
const tonightReplyKind = 'tonight';

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
        anchor = null,
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
        anchor = null,
        creditHeld = false;

  const AskMessage.sending({this.anchor})
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
  const AskMessage.failed(AskFailure this.failure, {this.balance, this.retryText, this.requestId, this.questionRef, this.creditHeld = false, this.anchor})
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

  /// On a pending message or a failure: what it was sent with beside its words. Null for a plain message.
  final AskAnchor? anchor;

  /// Written by a model: carries the "can be wrong" line and Report this reply.
  bool get isModel => origin == AskOrigin.model;
}

class AskState {
  const AskState({this.messages = const [], this.sessionId, this.wallet, this.walletAt, this.thread});

  final List<AskMessage> messages;
  final String? sessionId;

  /// The doubt under way: its one free follow-up and its 2 check questions. Null before a paid doubt.
  final DoubtThread? thread;

  /// The wallet the latest server answer reported (a reply's `usageSnapshot`, or the balance a
  /// refusal named), and when. Fresher than the credits read until that read runs again.
  final AskWallet? wallet;
  final DateTime? walletAt;

  bool get busy => messages.any((m) => m.sending);
}

/// A doubt that was settled for 1 credit (MOBI-CONTRACT 2 and 3): the reply at [openedAt] opened it; it keeps its 2
/// real CUET questions, their marks, and the one free follow-up it has left.
class DoubtThread {
  const DoubtThread({
    required this.info,
    required this.openedAt,
    this.checks = const [],
    this.checksNote,
    this.marks = const {},
    this.picks = const {},
    this.answering = const {},
    this.attaching = false,
    this.error,
  });

  final ThreadInfo info;

  /// The index of the reply that opened the thread: its 2 questions sit under it.
  final int openedAt;
  final List<ThreadCheck> checks;

  /// Why there are no questions yet (the server's words), or null.
  final String? checksNote;

  /// The server's marks, by check question id. The first answer counts.
  final Map<String, CheckMark> marks;

  /// The option the student tapped, while it is being marked.
  final Map<String, int> picks;
  final Set<String> answering;

  /// The 2 questions are being found for a chapter the student picked.
  final bool attaching;

  /// A plain line when a mark or the questions could not be had. Nothing was charged.
  final String? error;

  bool get canFollowUp => info.followUpsLeft > 0;

  DoubtThread copyWith({
    ThreadInfo? info,
    List<ThreadCheck>? checks,
    String? checksNote,
    bool clearNote = false,
    Map<String, CheckMark>? marks,
    Map<String, int>? picks,
    Set<String>? answering,
    bool? attaching,
    String? error,
    bool clearError = false,
  }) =>
      DoubtThread(
        info: info ?? this.info,
        openedAt: openedAt,
        checks: checks ?? this.checks,
        checksNote: clearNote ? null : (checksNote ?? this.checksNote),
        marks: marks ?? this.marks,
        picks: picks ?? this.picks,
        answering: answering ?? this.answering,
        attaching: attaching ?? this.attaching,
        error: clearError ? null : (error ?? this.error),
      );
}

/// The words around a doubt's 2 questions when they cannot be had or marked. Nothing is ever charged for them.
abstract final class DoubtCheckCopy {
  static const markFailed = 'Mobi could not mark that answer just now. Tap it again. Nothing was charged, and it counts once.';
  static const attachFailed = 'Mobi could not find the questions just now. Try the chapter again. Nothing was charged.';
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
  ///
  /// [subject] and [chapter] anchor the doubt's 2 check questions (a starter or a chapter chip sends both).
  /// [replyKind] `tonight` asks for tonight's revise plan from the record (free). With a doubt open and its follow-up
  /// unused, a typed message goes as that follow-up (free).
  Future<AskFailure?> send(String raw, {String? subject, String? chapter, String? replyKind}) async {
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
    final local = questionRef != null || insights == null || replyKind != null ? null : answerFromInsights(text, insights, pro: ref.read(insightsProProvider));
    if (local != null) {
      _append([AskMessage.student(text), AskMessage.reply(local.reply, origin: AskOrigin.phone, actions: local.actions)]);
      return null;
    }
    final thread = state.thread;
    final followUp = questionRef == null && replyKind == null && thread != null && thread.canFollowUp ? thread.info.id : null;
    final anchor = AskAnchor.fromJson({
      'threadId': followUp,
      'subject': followUp == null ? subject : null,
      'chapter': followUp == null ? chapter : null,
      'replyKind': replyKind,
    });
    _append([AskMessage.student(text), AskMessage.sending(anchor: anchor)]);
    final index = state.messages.length - 1;
    // A fixed record ask asked before the record has reached the phone (the first ask after a cold
    // start, v15.1 walk): it waits for the record and is answered here, never sent to the network
    // while the record is on its way. Only a record that does not come goes to the server, which
    // answers record questions too.
    if (questionRef == null && insights == null && isRecordAsk(text)) {
      final epoch = _epoch;
      final record = await _awaitRecord();
      if (epoch != _epoch || !ref.mounted) return null;
      final answer = record == null ? null : answerFromInsights(text, record, pro: ref.read(insightsProProvider));
      if (answer != null) {
        _replaceAt(index, AskMessage.reply(answer.reply, origin: AskOrigin.phone, actions: answer.actions));
        return null;
      }
    }
    return _post(index, text, const Uuid().v4(), questionRef: questionRef, anchor: anchor);
  }

  /// The fixed record asks (the Ask screen's record tiles and its follow-up rail): each is answered
  /// from the record on this phone.
  static final Set<String> recordAsks = {for (final p in [...recordPrompts(null), ...moreRecordPrompts()]) p.text};

  /// True when [text] is one of [recordAsks].
  static bool isRecordAsk(String text) => recordAsks.contains(text.trim());

  /// How long a record ask waits for the record before the server is asked instead.
  static const Duration recordWait = Duration(seconds: 15);

  /// The record, once the read already on its way (or a new one) lands; null when it does not
  /// come within [recordWait].
  Future<PrepInsights?> _awaitRecord() async {
    try {
      await ref.read(insightsRepositoryProvider.notifier).refresh().timeout(recordWait);
    } on Object {
      // Too slow or failed: the server is asked instead.
    }
    if (!ref.mounted) return null;
    return ref.read(insightsRepositoryProvider).value;
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
    _replaceAt(i, AskMessage.sending(anchor: failed.anchor));
    return _post(i, text, failed.requestId ?? const Uuid().v4(), questionRef: failed.questionRef, anchor: failed.anchor);
  }

  // ---- A question in flight survives the app being killed ----------------------------------

  static const _pendingKey = 'ask_pending_request';

  /// How long a remembered question is still offered again.
  static const _pendingFor = Duration(hours: 24);

  Future<void> _remember(PrefsStore store, String text, String requestId, String? questionRef, AskAnchor? anchor) async {
    try {
      await store.setString(
        _pendingKey,
        jsonEncode({
          'text': text,
          'requestId': requestId,
          'questionRef': ?questionRef,
          'anchor': ?anchor?.toJson(),
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
          AskMessage.failed(
            AskFailure.interrupted,
            retryText: text,
            requestId: requestId,
            questionRef: cleanQuestionRef(j['questionRef'] is String ? j['questionRef'] as String : null),
            // Sent again as the same kind of message: a follow-up stays a follow-up (a thread the server cannot
            // find costs nothing).
            anchor: AskAnchor.fromJson(j['anchor']),
          ),
        ],
        sessionId: j['sessionId'] is String ? j['sessionId'] as String : null,
      );
    } on Object {
      // Nothing to bring back.
    }
  }

  Future<AskFailure?> _post(int index, String text, String requestId, {String? questionRef, AskAnchor? anchor}) async {
    final epoch = _epoch;
    final store = ref.read(insightsPrefsStoreProvider);
    await _remember(store, text, requestId, questionRef, anchor);
    try {
      final res = await ref.read(apiClientProvider).post('/api/ai/mentor/chat', body: {
        'message': text,
        'mode': replyMode,
        'requestId': requestId,
        'sessionId': ?state.sessionId,
        // The server builds the question's context itself from the student's own attempt.
        'questionRef': ?questionRef,
        ...?anchor?.toJson(),
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
      _adoptThread(index, body);
      if (origin == AskOrigin.model) ref.read(creditsRepositoryProvider.notifier).refresh();
      return null;
    } on ApiError catch (e) {
      // No answer while the phone is online is a slow server, never "You are offline" (v15.1 walk).
      final failure = askFailureFor(e, network: e.isOffline ? _networkStatus() : NetworkStatus.unknown);
      // Only an unknown outcome stays remembered: every other failure is the server saying what
      // happened to the question, so there is nothing to recover.
      if (failure != AskFailure.offline && failure != AskFailure.slow && failure != AskFailure.inProgress) await _forget(store);
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
      // A full thread has no follow-up left: the composer closes and offers a new doubt instead.
      if (failure == AskFailure.threadFull && state.thread != null) {
        final t = state.thread!;
        _setThread(
          t.info.id,
          (t) => t.copyWith(info: ThreadInfo(id: t.info.id, followUpsLeft: 0, followUpsMax: t.info.followUpsMax, subject: t.info.subject, chapter: t.info.chapter)),
        );
      }
      _replaceAt(
        index,
        AskMessage.failed(
          failure,
          balance: balance,
          retryText: text,
          requestId: next,
          questionRef: questionRef,
          creditHeld: e.serverMessage?.contains('held briefly') ?? false,
          anchor: anchor,
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

  /// The connection monitor's word, or unknown when it cannot be read. It is only read when it is
  /// already running (the app's shell watches it), so a failed reply never starts the monitor.
  NetworkStatus _networkStatus() {
    try {
      if (!ref.exists(networkStatusProvider)) return NetworkStatus.unknown;
      return ref.read(networkStatusProvider);
    } on Object {
      return NetworkStatus.unknown;
    }
  }

  static List<(String, String)> _actions(Object? raw) => [
        for (final a in asJsonList(raw))
          if (asString(a['label']) case final label? when asString(a['route']) != null) (label, asString(a['route'])!),
      ];

  AskWallet? _readWallet() {
    final c = ref.read(creditsRepositoryProvider).value;
    return c == null ? null : AskWallet.fromCredits(c);
  }

  /// Puts the conversation away and starts a new one at Ask Mobi's two doors (ASK-MOBI-1019 B). The
  /// wallet the server last reported stays. Never while a reply is on its way: nothing in flight is lost.
  void startOver() {
    if (state.busy || state.messages.isEmpty) return;
    _epoch++;
    state = AskState(wallet: state.wallet, walletAt: state.walletAt);
    _answerIds.clear();
  }

  void _append(List<AskMessage> add) => state = AskState(
        messages: [...state.messages, ...add],
        sessionId: state.sessionId,
        wallet: state.wallet,
        walletAt: state.walletAt,
        thread: state.thread,
      );

  void _replaceAt(int index, AskMessage m, {String? sessionId, AskWallet? wallet}) {
    if (!ref.mounted || index >= state.messages.length) return;
    final next = [...state.messages]..[index] = m;
    state = AskState(
      messages: next,
      sessionId: sessionId ?? state.sessionId,
      wallet: wallet ?? state.wallet,
      walletAt: wallet != null ? ref.read(nowProvider)() : state.walletAt,
      thread: state.thread,
    );
  }

  // ---- The doubt thread (MOBI-CONTRACT 2 and 3) -------------------------------------------------------------

  /// A reply that carries a thread: a new doubt opens it under the reply at [index] with its 2 questions; a
  /// follow-up only counts its follow-up down (the thread keeps its 2).
  void _adoptThread(int index, Map<String, dynamic> body) {
    final info = ThreadInfo.tryParse(body['thread']);
    if (info == null || !ref.mounted) return;
    final current = state.thread;
    final checks = [for (final c in asJsonList(body['checks'])) ?ThreadCheck.tryParse(c)].take(2).toList();
    final note = asString(body['checksNote'])?.trim();
    final DoubtThread next;
    if (current != null && current.info.id == info.id) {
      next = current.copyWith(info: info, clearError: true);
    } else {
      next = DoubtThread(info: info, openedAt: index, checks: checks, checksNote: note == null || note.isEmpty ? null : note);
    }
    state = AskState(messages: state.messages, sessionId: state.sessionId, wallet: state.wallet, walletAt: state.walletAt, thread: next);
  }

  void _setThread(String id, DoubtThread Function(DoubtThread t) change) {
    final t = state.thread;
    if (!ref.mounted || t == null || t.info.id != id) return;
    state = AskState(messages: state.messages, sessionId: state.sessionId, wallet: state.wallet, walletAt: state.walletAt, thread: change(t));
  }

  /// One request id per check question, kept across taps: a retry after a lost mark is the same answer.
  final Map<String, String> _answerIds = {};

  /// Answers one of the thread's 2 questions with [pick] (0 to 3, as shown). Free; the server marks it, and the first
  /// answer counts.
  Future<void> answerCheck(String checkQuestionId, int pick) async {
    final t = state.thread;
    if (t == null || t.marks.containsKey(checkQuestionId) || t.answering.contains(checkQuestionId)) return;
    final id = t.info.id;
    final requestId = _answerIds.putIfAbsent(checkQuestionId, () => const Uuid().v4());
    _setThread(id, (t) => t.copyWith(answering: {...t.answering, checkQuestionId}, picks: {...t.picks, checkQuestionId: pick}, clearError: true));
    try {
      final mark = await ref.read(mobiApiProvider).answer(threadId: id, checkQuestionId: checkQuestionId, pick: pick, requestId: requestId);
      _setThread(id, (t) => t.copyWith(marks: {...t.marks, checkQuestionId: mark}, answering: {...t.answering}..remove(checkQuestionId)));
    } on Object {
      _setThread(
        id,
        (t) => t.copyWith(answering: {...t.answering}..remove(checkQuestionId), picks: {...t.picks}..remove(checkQuestionId), error: DoubtCheckCopy.markFailed),
      );
    }
  }

  /// Asks for the thread's 2 questions on [chapter] (a chapter chip, when the doubt named none). Free, and once.
  Future<void> attachChecks(String subject, String chapter) async {
    final t = state.thread;
    if (t == null || t.attaching || t.checks.isNotEmpty) return;
    final id = t.info.id;
    _setThread(id, (t) => t.copyWith(attaching: true, clearError: true));
    try {
      final got = await ref.read(mobiApiProvider).attachChecks(threadId: id, subject: subject, chapter: chapter);
      _setThread(
        id,
        (t) => t.copyWith(
          checks: got.checks,
          checksNote: got.note,
          clearNote: got.note == null,
          attaching: false,
          info: ThreadInfo(id: t.info.id, followUpsLeft: t.info.followUpsLeft, followUpsMax: t.info.followUpsMax, subject: subject, chapter: chapter),
        ),
      );
    } on Object {
      _setThread(id, (t) => t.copyWith(attaching: false, error: DoubtCheckCopy.attachFailed));
    }
  }
}

final askControllerProvider = NotifierProvider<AskController, AskState>(AskController.new);

/// The failure a refused or lost question ends in. The server's machine code decides first (the
/// codes the website and the repair route share); the HTTP status only for a code it has not met.
///
/// No answer at all is [AskFailure.offline] only when the phone has no connection: with the
/// connection monitor saying [network] is online, or a request that connected and then timed out
/// while the monitor does not say offline, the server was slow ([AskFailure.slow]).
AskFailure askFailureFor(ApiError e, {NetworkStatus network = NetworkStatus.unknown}) {
  if (e.isOffline) {
    final slow = network == NetworkStatus.online || (e.kind == ApiErrorKind.timeout && network != NetworkStatus.offline);
    return slow ? AskFailure.slow : AskFailure.offline;
  }
  return switch (e.code.toLowerCase()) {
    'insufficient_ai_credits' => AskFailure.noCredits,
    'thread_full' => AskFailure.threadFull,
    'thread_not_found' => AskFailure.threadGone,
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
