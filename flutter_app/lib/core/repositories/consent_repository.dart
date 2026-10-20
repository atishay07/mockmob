import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_error.dart';
import '../api/api_providers.dart';
import '../models/consent.dart';
import '../storage/storage_providers.dart';
import 'local_scope.dart';

enum ConsentStatus { notLoaded, loading, loaded, failed }

class ConsentState {
  const ConsentState({this.status = ConsentStatus.notLoaded, this.consent = const Consent(), this.withdrawalPending = false});

  final ConsentStatus status;
  final Consent consent;

  /// The student withdrew usage data but the server has not acknowledged it yet. Collection
  /// stays off meanwhile.
  final bool withdrawalPending;

  bool get isLoaded => status == ConsentStatus.loaded;

  /// Analytics may queue and send only when the consent read succeeded, the student did not say they are
  /// under 18 and allowed it, and no withdrawal is pending. A failed or missing read means off.
  bool get analyticsActive => isLoaded && consent.canCollect && !withdrawalPending;

  ConsentState copyWith({ConsentStatus? status, Consent? consent, bool? withdrawalPending}) => ConsentState(
        status: status ?? this.status,
        consent: consent ?? this.consent,
        withdrawalPending: withdrawalPending ?? this.withdrawalPending,
      );
}

/// `GET/PUT /api/me/consent`: age band and the usage-data switch. Usage data is on for 18 or older and
/// for "Rather not say", off only for under 18 (D183); the switch starts on in onboarding and anyone can
/// turn it off. State changes on a turn-on only after the server acknowledges; a
/// withdrawal closes the gate immediately, before the network call returns.
class ConsentRepository extends Notifier<ConsentState> {
  String? _userId;
  final List<Future<void> Function()> _beforeWithdrawal = [];

  /// Registers work that must finish before a withdrawal goes over the network (the usage-data
  /// queue is dropped this way). Returns a function that removes the hook.
  void Function() addBeforeWithdrawalHook(Future<void> Function() hook) {
    _beforeWithdrawal.add(hook);
    return () => _beforeWithdrawal.remove(hook);
  }

  @override
  ConsentState build() {
    _userId = ref.watch(userIdProvider);
    if (_userId == null) return const ConsentState();
    scheduleMicrotask(load);
    return const ConsentState(status: ConsentStatus.loading);
  }

  /// Reads the consent record. Call after sign-in; the repository also does this itself.
  /// A failure leaves analytics off. A withdrawal that never reached the server is re-sent
  /// first, using the age band the server holds.
  Future<void> load() => _loading ??= _load().whenComplete(() => _loading = null);

  /// The read in flight, shared so a caller that needs the answer waits for it instead of racing
  /// a second GET.
  Future<void>? _loading;

  Future<void> _load() async {
    final id = _userId;
    if (id == null || !ref.mounted) return;
    final prefs = ref.read(appPrefsProvider);
    final pending = await prefs.pendingWithdrawalFor() == id;
    state = state.copyWith(status: ConsentStatus.loading, withdrawalPending: pending);
    try {
      final response = await ref.read(apiClientProvider).get('/api/me/consent');
      final server = Consent.fromJson(response.map);
      if (!ref.mounted) return;
      if (pending) {
        state = ConsentState(status: ConsentStatus.loaded, consent: Consent(ageBand: server.ageBand, decidedAt: server.decidedAt), withdrawalPending: true);
        await _put(server.ageBand, false);
      } else {
        state = ConsentState(status: ConsentStatus.loaded, consent: server);
      }
    } on ApiError {
      if (ref.mounted) state = state.copyWith(status: ConsentStatus.failed);
    }
  }

  /// Saves the answer to "Are you 18 or older?". Usage data is written off for "Not yet" (under 18). For
  /// 18 or older and for "Rather not say" it keeps an earlier "allowed" and otherwise waits for the
  /// switch the student sees next (on by default, saved when they continue). Throws `ApiError`.
  ///
  /// Each write is for [expectUserId] when given, else for the account this repository holds;
  /// it is never sent with another account's token ([ApiError.accountChanged]).
  ///
  /// The write waits for the consent read. Without it the repository does not know whether the
  /// student already allowed usage data, would send `analyticsAllowed: false`, and so switch an
  /// existing opt-in off on the server with no message (onboarding-02). If the read cannot be
  /// made the write is refused as a network failure and nothing is sent; the caller keeps the
  /// answer and tries again.
  Future<Consent> setAgeBand(AgeBand band, {String? expectUserId}) async {
    if (_userId == null) throw const ApiError.signedOut();
    if (!state.isLoaded) {
      await load();
      if (!state.isLoaded) throw const ApiError(kind: ApiErrorKind.network, code: 'network');
    }
    final keepOn = band != AgeBand.minor && state.consent.ageBand != AgeBand.minor && state.consent.analyticsAllowed;
    return _put(band, keepOn, expectUserId);
  }

  /// Turns usage data on or off. On: the switch shows on only after the server acknowledges.
  /// Throws `ApiError`.
  /// Off: collection stops at once and the queue is cleared before the call; the result carries
  /// `deletedEvents`. A 503 means the choice was saved but the delete failed: call again.
  ///
  /// The age band is always sent as the account holds it: this never changes a student's age answer
  /// ("Rather not say" stays unknown, 18 or older stays adult). Only the student's own "18 or older" in
  /// [setAgeBand] ever makes an account adult. Turning it on for a record that is under 18 or was never
  /// answered (or not read yet) is refused before anything is sent ([usageNotForThisAge]): usage data
  /// stays off and the record is untouched.
  Future<Consent> setAnalyticsAllowed(bool allowed, {String? expectUserId}) async {
    final c = state.consent;
    if (allowed && !(state.isLoaded && c.switchAvailable)) throw usageNotForThisAge;
    return _put(c.ageBand, allowed, expectUserId);
  }

  /// The refusal of a turn-on for an account that is under 18, never answered the age question, or whose
  /// record is not read. Nothing was sent.
  static const ApiError usageNotForThisAge = ApiError(kind: ApiErrorKind.validation, code: 'usage_not_for_this_age');

  Future<Consent> _put(AgeBand band, bool allowed, [String? expectUserId]) async {
    final id = _userId;
    if (id == null) throw const ApiError.signedOut();
    // Checked before anything changes: a write for an account that is no longer signed in
    // touches nothing of the one that is.
    if (expectUserId != null && expectUserId != id) throw const ApiError.accountChanged();
    final prefs = ref.read(appPrefsProvider);
    if (!allowed) {
      // Close the gate before anything goes over the network. Listeners (the analytics
      // client) see this synchronously and drop the queue.
      // The answer is kept (decidedAt), so "Rather not say" still reads as answered while the withdrawal is in flight.
      state = state.copyWith(consent: Consent(ageBand: band, decidedAt: state.consent.decidedAt ?? DateTime.now()), withdrawalPending: true);
      for (final hook in List.of(_beforeWithdrawal)) {
        await hook();
      }
      await prefs.setPendingWithdrawalFor(id);
    }
    final response = await ref.read(apiClientProvider).put(
          '/api/me/consent',
          body: {'ageBand': band.name, 'analyticsAllowed': allowed},
          expectUserId: id,
        );
    final consent = Consent.fromJson(response.map);
    if (allowed) await prefs.setAnalyticsStoppedFor(null);
    await prefs.setPendingWithdrawalFor(null);
    // A reply that lands after another account signed in is not that account's consent.
    if (ref.mounted && _userId == id) state = ConsentState(status: ConsentStatus.loaded, consent: consent);
    return consent;
  }
}

final consentRepositoryProvider = NotifierProvider<ConsentRepository, ConsentState>(ConsentRepository.new);
