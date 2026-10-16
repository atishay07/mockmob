import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../connectivity/connectivity.dart' show networkRestoredProvider;
import '../repositories/consent_repository.dart';
import '../repositories/local_scope.dart';
import '../router/router.dart' show routerProvider;
import 'error_reporter.dart';
import 'error_uploader.dart';

/// The reporter of the running app (the same object `main.dart` hands errors to).
final errorReporterProvider = Provider<ErrorReporter>((ref) => ErrorReporter.shared);

ErrorGate _gateOf(Ref ref) {
  final consent = ref.read(consentRepositoryProvider);
  return ErrorGate(
    signedIn: ref.read(userIdProvider) != null,
    consentActive: consent.analyticsActive,
    // Known off: the read succeeded and the answer is no, or a withdrawal is pending.
    consentKnownOff: consent.isLoaded && !consent.analyticsActive,
  );
}

/// Sends the buffered reports when the student's usage-data switch is on, the phone is online and
/// somebody is signed in. The buffer is emptied on withdrawal, on a "no" answer and on a change
/// of account.
final errorUploaderProvider = Provider<ErrorUploader>((ref) {
  final reporter = ref.watch(errorReporterProvider);
  final uploader = ErrorUploader(
    buffer: reporter.buffer,
    transport: ApiErrorTransport(ref.watch(apiClientProvider)),
    gate: () => _gateOf(ref),
    facts: () => reporter.facts,
    run: reporter.run,
  );

  void applyConsent() {
    final gate = _gateOf(ref);
    if (gate.consentKnownOff) {
      reporter.collectionAllowed = false;
      unawaited(reporter.buffer.clear().catchError((Object _) {}));
    } else {
      reporter.collectionAllowed = true;
      if (gate.open) {
        uploader.resume();
        unawaited(uploader.flush());
      }
    }
  }

  // Withdrawal: drop the buffer before the consent call goes out, as the usage-data queue does.
  ref.onDispose(ref.read(consentRepositoryProvider.notifier).addBeforeWithdrawalHook(() async {
    reporter.collectionAllowed = false;
    await reporter.buffer.clear();
  }));
  ref.listen(consentRepositoryProvider, (previous, next) => applyConsent());
  // Sign-out and account switch: nothing kept for the last account is sent for the next one.
  ref.listen(userIdProvider, (previous, next) {
    if (previous != next) {
      reporter.collectionAllowed = true;
      unawaited(reporter.buffer.clear().catchError((Object _) {}));
    }
  });
  ref.listen(networkRestoredProvider, (previous, next) => unawaited(uploader.flush()));
  return uploader;
});

/// Wraps the app (once, under the ProviderScope): starts the uploader, gives the reporter the
/// current route, and tries a send shortly after launch, every ten minutes, and when the app
/// comes back to the front. Draws nothing of its own.
class ErrorReportingHost extends ConsumerStatefulWidget {
  const ErrorReportingHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<ErrorReportingHost> createState() => _ErrorReportingHostState();
}

class _ErrorReportingHostState extends ConsumerState<ErrorReportingHost> with WidgetsBindingObserver {
  Timer? _first;
  Timer? _every;
  ErrorUploader? _uploader;
  ProviderSubscription<ErrorUploader>? _hold;
  ErrorReporter? _reporter;

  @override
  void initState() {
    super.initState();
    try {
      WidgetsBinding.instance.addObserver(this);
      final reporter = ref.read(errorReporterProvider);
      _reporter = reporter;
      reporter.screenOf = _screen;
      // Listened to for as long as the host lives, so the uploader's own listeners (consent,
      // account, network) are never paused.
      _hold = ref.listenManual(errorUploaderProvider, (previous, next) {});
      _uploader = ref.read(errorUploaderProvider);
      unawaited(reporter.ensureFacts());
      _first = Timer(const Duration(seconds: 30), _flush);
      _every = Timer.periodic(const Duration(minutes: 10), (_) => _flush());
    } on Object {
      // Reporting is optional; the app runs without it.
    }
  }

  String? _screen() {
    if (!mounted) return null;
    try {
      return ref.read(routerProvider).routerDelegate.currentConfiguration.uri.path;
    } on Object {
      return null;
    }
  }

  void _flush() {
    try {
      unawaited(_uploader?.flush());
    } on Object {
      // Never a second failure.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _flush();
  }

  @override
  void dispose() {
    _first?.cancel();
    _every?.cancel();
    _hold?.close();
    WidgetsBinding.instance.removeObserver(this);
    if (_reporter?.screenOf == _screen) _reporter?.screenOf = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
