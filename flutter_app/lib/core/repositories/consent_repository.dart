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

  /// Analytics may queue and send only when the consent read succeeded, the student is an
  /// adult who allowed it, and no withdrawal is pending. A failed or missing read means off.
  bool get analyticsActive => isLoaded && consent.canCollect && !withdrawalPending;

  ConsentState copyWith({ConsentStatus? status, Consent? consent, bool? withdrawalPending}) => ConsentState(
        status: status ?? this.status,
        consent: consent ?? this.consent,
        withdrawalPending: withdrawalPending ?? this.withdrawalPending,
      );
}

/// `GET/PUT /api/me/consent`: age band and the usage-data switch. Usage data is off unless an
/// adult turned it on. State changes on a turn-on only after the server acknowledges; a
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
  Future<void> load() async {
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
        state = ConsentState(status: ConsentStatus.loaded, consent: Consent(ageBand: server.ageBand), withdrawalPending: true);
        await _put(server.ageBand, false);
      } else {
        state = ConsentState(status: ConsentStatus.loaded, consent: server);
      }
    } on ApiError {
      if (ref.mounted) state = state.copyWith(status: ConsentStatus.failed);
    }
  }

  /// Saves the answer to "Are you 18 or older?". Usage data stays off unless the student is
  /// an adult who already allowed it. Throws `ApiError`.
  Future<Consent> setAgeBand(AgeBand band) {
    final keepOn = band == AgeBand.adult && state.consent.ageBand == AgeBand.adult && state.consent.analyticsAllowed;
    return _put(band, keepOn);
  }

  /// Turns usage data on or off. On: the switch shows on only after the server acknowledges.
  /// Off: collection stops at once and the queue is cleared before the call; the result carries
  /// `deletedEvents`. A 503 means the choice was saved but the delete failed: call again.
  Future<Consent> setAnalyticsAllowed(bool allowed) {
    return _put(allowed ? AgeBand.adult : state.consent.ageBand, allowed);
  }

  Future<Consent> _put(AgeBand band, bool allowed) async {
    final id = _userId;
    if (id == null) throw const ApiError.signedOut();
    final prefs = ref.read(appPrefsProvider);
    if (!allowed) {
      // Close the gate before anything goes over the network. Listeners (the analytics
      // client) see this synchronously and drop the queue.
      state = state.copyWith(consent: Consent(ageBand: band), withdrawalPending: true);
      for (final hook in List.of(_beforeWithdrawal)) {
        await hook();
      }
      await prefs.setPendingWithdrawalFor(id);
    }
    final response = await ref.read(apiClientProvider).put(
          '/api/me/consent',
          body: {'ageBand': band.name, 'analyticsAllowed': allowed},
        );
    final consent = Consent.fromJson(response.map);
    if (allowed) await prefs.setAnalyticsStoppedFor(null);
    await prefs.setPendingWithdrawalFor(null);
    if (ref.mounted) state = ConsentState(status: ConsentStatus.loaded, consent: consent);
    return consent;
  }
}

final consentRepositoryProvider = NotifierProvider<ConsentRepository, ConsentState>(ConsentRepository.new);
