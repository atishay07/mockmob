import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/credits_repository.dart';
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

enum AskFailure { offline, noCredits, paused, resend, rateLimited, tooLong, unavailable }

class AskMessage {
  const AskMessage.student(this.text)
      : fromStudent = true,
        origin = null,
        actions = const [],
        sending = false,
        failure = null,
        balance = null,
        requestId = null;

  const AskMessage.reply(this.text, {required AskOrigin this.origin, this.actions = const [], this.requestId})
      : fromStudent = false,
        sending = false,
        failure = null,
        balance = null;

  const AskMessage.sending()
      : fromStudent = false,
        text = '',
        origin = null,
        actions = const [],
        sending = true,
        failure = null,
        balance = null,
        requestId = null;

  const AskMessage.failed(AskFailure this.failure, {this.balance})
      : fromStudent = false,
        text = '',
        origin = null,
        actions = const [],
        sending = false,
        requestId = null;

  final bool fromStudent;
  final String text;
  final AskOrigin? origin;

  /// (label, href) pairs. The screen maps hrefs to app routes and hides what it cannot open.
  final List<(String, String)> actions;
  final bool sending;
  final AskFailure? failure;

  /// Credits the server said the student has, on [AskFailure.noCredits].
  final int? balance;

  /// The request that produced a server reply, so a report names exactly that reply.
  final String? requestId;

  /// Written by a model: carries the "can be wrong" line and Report this reply.
  bool get isModel => origin == AskOrigin.model;
}

class AskState {
  const AskState({this.messages = const [], this.sessionId});

  final List<AskMessage> messages;
  final String? sessionId;

  bool get busy => messages.isNotEmpty && messages.last.sending;
}

/// The longest message the server accepts.
const askMaxChars = 1500;

/// Ask your record. Questions about marks, chapters, timing or the week are answered on the
/// phone from the record (free, works offline). Anything else goes to `POST /api/ai/mentor/chat`,
/// whose budget guard decides: a free record answer, a paused notice, or a 1-credit reply.
class AskController extends Notifier<AskState> {
  String? _pendingText;
  String? _pendingRequestId;

  @override
  AskState build() {
    ref.watch(authSnapshotProvider.select((s) => s.userId));
    return const AskState();
  }

  /// True when [raw] is answered on the phone from the record, so nothing leaves the phone.
  bool answersOnPhone(String raw) {
    final text = raw.trim();
    if (text.isEmpty || text.length > askMaxChars) return true;
    final insights = ref.read(insightsRepositoryProvider).value;
    return insights != null && answerFromInsights(text, insights, pro: ref.read(insightsProProvider)) != null;
  }

  Future<void> send(String raw) async {
    final text = raw.trim();
    if (text.isEmpty || state.busy) return;
    if (text.length > askMaxChars) {
      _append([const AskMessage.failed(AskFailure.tooLong)]);
      return;
    }
    final insights = ref.read(insightsRepositoryProvider).value;
    final local = insights == null ? null : answerFromInsights(text, insights, pro: ref.read(insightsProProvider));
    if (local != null) {
      _append([AskMessage.student(text), AskMessage.reply(local.reply, origin: AskOrigin.phone, actions: local.actions)]);
      return;
    }
    _pendingText = text;
    _pendingRequestId = const Uuid().v4();
    _append([AskMessage.student(text), const AskMessage.sending()]);
    await _post();
  }

  /// Sends the failed message again. After an unknown outcome the same request id goes, so a
  /// reply that did arrive is never charged twice.
  Future<void> retry() async {
    if (_pendingText == null || state.busy) return;
    _replaceLast(const AskMessage.sending());
    await _post();
  }

  Future<void> _post() async {
    final text = _pendingText!;
    final requestId = _pendingRequestId;
    try {
      final res = await ref.read(apiClientProvider).post('/api/ai/mentor/chat', body: {
        'message': text,
        'mode': 'mentor',
        'requestId': _pendingRequestId,
        'sessionId': ?state.sessionId,
      });
      final body = res.map;
      final origin = switch (asString(body['origin'])) {
        'model' => AskOrigin.model,
        'status' => AskOrigin.paused,
        _ => AskOrigin.record,
      };
      final actions = [
        for (final a in asJsonList(body['actions']))
          if (asString(a['label']) case final label? when asString(a['route']) != null) (label, asString(a['route'])!),
      ];
      _pendingText = null;
      _pendingRequestId = null;
      state = AskState(
        messages: [..._withoutLast(), AskMessage.reply(asStringOr(body['reply'], ''), origin: origin, actions: actions, requestId: requestId)],
        sessionId: asString(body['sessionId']) ?? state.sessionId,
      );
      if (origin == AskOrigin.model) ref.read(creditsRepositoryProvider.notifier).refresh();
    } on ApiError catch (e) {
      final failure = switch (e.kind) {
        ApiErrorKind.network || ApiErrorKind.timeout => AskFailure.offline,
        ApiErrorKind.paymentRequired => AskFailure.noCredits,
        ApiErrorKind.unavailable => AskFailure.paused,
        ApiErrorKind.conflict => AskFailure.resend,
        ApiErrorKind.rateLimited => AskFailure.rateLimited,
        ApiErrorKind.payloadTooLarge => AskFailure.tooLong,
        _ => AskFailure.unavailable,
      };
      // "Did not go through": a fresh id. Anything uncertain keeps the id for the retry.
      if (failure == AskFailure.resend) _pendingRequestId = const Uuid().v4();
      _replaceLast(AskMessage.failed(failure, balance: asInt(e.details['balance'])));
    }
  }

  List<AskMessage> _withoutLast() => state.messages.isEmpty ? const [] : state.messages.sublist(0, state.messages.length - 1);

  void _append(List<AskMessage> add) => state = AskState(messages: [...state.messages, ...add], sessionId: state.sessionId);

  void _replaceLast(AskMessage m) => state = AskState(messages: [..._withoutLast(), m], sessionId: state.sessionId);
}

final askControllerProvider = NotifierProvider<AskController, AskState>(AskController.new);
