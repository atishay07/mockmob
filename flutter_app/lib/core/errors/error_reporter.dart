import 'dart:async';
import 'dart:io' show Platform;
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:package_info_plus/package_info_plus.dart';

import '../storage/prefs_store.dart';
import 'error_buffer.dart';
import 'error_report.dart';
import 'error_scrubber.dart';

/// The phone and the build, as coarse as the server keeps them.
Future<DeviceFacts> loadDeviceFacts() async {
  String? version;
  String? build;
  try {
    final info = await PackageInfo.fromPlatform();
    version = info.version.isEmpty ? null : info.version;
    build = info.buildNumber.isEmpty ? null : info.buildNumber;
  } on Object {
    // The report goes without a version rather than not at all.
  }
  return DeviceFacts(
    appVersion: version,
    build: build,
    platform: _platformName(),
    osVersion: _osVersion(),
    deviceClass: _deviceClass(),
  );
}

String _platformName() {
  try {
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
  } on Object {
    // Fall through to other.
  }
  return 'other';
}

/// "Android 14" when the kernel string names it; otherwise the first 32 characters, scrubbed.
String? _osVersion() {
  try {
    final raw = Platform.operatingSystemVersion;
    final android = RegExp(r'android(\d+)', caseSensitive: false).firstMatch(raw);
    if (android != null) return 'Android ${android[1]}';
    final clean = trimChars(scrubErrorText(raw).trim(), 32).trim();
    return clean.isEmpty ? null : clean;
  } on Object {
    return null;
  }
}

/// Phone or tablet by the shortest side in dp (600 and up is a tablet).
String _deviceClass() {
  try {
    final views = PlatformDispatcher.instance.views;
    if (views.isEmpty) return 'other';
    final view = views.first;
    final size = view.physicalSize;
    if (size.isEmpty || view.devicePixelRatio <= 0) return 'other';
    final shortest = (size.width < size.height ? size.width : size.height) / view.devicePixelRatio;
    return shortest >= 600 ? 'tablet' : 'phone';
  } on Object {
    return 'other';
  }
}

/// Catches errors where `main.dart` hands them over and keeps them on the phone. It never throws,
/// never waits for anything and never lets a failure while reporting become a second report.
///
/// Collection stops (and the buffer is emptied) once the student's usage-data choice is known to
/// be off. Before that choice is known, reports are only kept on the phone; nothing is sent.
class ErrorReporter {
  ErrorReporter({
    required this.buffer,
    DateTime Function()? now,
    Future<DeviceFacts> Function()? factsLoader,
    int? run,
    this.maxPerMinute = 30,
  })  : _now = now ?? DateTime.now,
        _factsLoader = factsLoader ?? loadDeviceFacts,
        run = run ?? (now ?? DateTime.now)().millisecondsSinceEpoch;

  static ErrorReporter? _shared;

  /// The one reporter of the running app. Built on first use, with the phone's own storage.
  static ErrorReporter get shared => _shared ??= ErrorReporter(buffer: ErrorBuffer(SharedPrefsStore()));

  @visibleForTesting
  static set shared(ErrorReporter? reporter) => _shared = reporter;

  final ErrorBuffer buffer;
  final DateTime Function() _now;
  final Future<DeviceFacts> Function() _factsLoader;
  final int maxPerMinute;

  /// Identifies this process; reports carry it so facts learned late are only added to this run's.
  final int run;

  DeviceFacts? facts;

  /// The current route, read when an error is reported. Set by the host once the router exists.
  String? Function()? screenOf;

  /// False once the student's usage-data choice is known to be off.
  bool collectionAllowed = true;

  bool _reporting = false;
  int _windowStart = 0;
  int _windowCount = 0;
  Future<void>? _loadingFacts;

  /// Keeps one error. Safe to call from any error handler, at any time.
  void report(Object error, StackTrace? stack, {String kind = ErrorKinds.other}) {
    if (_reporting || !collectionAllowed) return;
    _reporting = true;
    try {
      final nowMs = _now().millisecondsSinceEpoch;
      if (!_admit(nowMs)) return;
      String? screen;
      try {
        screen = screenOf?.call();
      } on Object {
        screen = null;
      }
      final report = ErrorReport.fromError(
        error,
        stack,
        kind: kind,
        atMs: nowMs,
        run: run,
        screen: screen,
        facts: facts ?? const DeviceFacts(),
      );
      unawaited(buffer.add(report).catchError((Object _) {}));
      if (facts == null) unawaited(ensureFacts());
    } on Object {
      // Reporting must never fail the app.
    } finally {
      _reporting = false;
    }
  }

  /// At most [maxPerMinute] errors a minute: a loop that throws every frame costs one counter.
  bool _admit(int nowMs) {
    if (nowMs - _windowStart >= 60000) {
      _windowStart = nowMs;
      _windowCount = 0;
    }
    if (_windowCount >= maxPerMinute) return false;
    _windowCount++;
    return true;
  }

  /// Reads the phone facts once and adds them to this run's reports made before they were known.
  Future<void> ensureFacts() => _loadingFacts ??= _loadFacts();

  Future<void> _loadFacts() async {
    try {
      final loaded = await _factsLoader();
      facts = loaded;
      await buffer.fillFacts(run, loaded);
    } on Object {
      // Reports go without facts.
    }
  }
}
