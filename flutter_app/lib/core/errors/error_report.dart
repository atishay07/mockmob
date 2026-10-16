import 'dart:convert';

import 'error_scrubber.dart';

/// Where an error came from. These are the only values the server accepts.
abstract final class ErrorKinds {
  static const flutter = 'flutter';
  static const platform = 'platform';
  static const zone = 'zone';
  static const other = 'other';
  static const all = {flutter, platform, zone, other};
}

/// Facts about the phone and the build, as coarse as the server table keeps them: no device id,
/// no model, no account.
class DeviceFacts {
  const DeviceFacts({this.appVersion, this.build, this.platform = 'other', this.osVersion, this.deviceClass = 'other'});

  final String? appVersion;
  final String? build;
  final String platform;
  final String? osVersion;
  final String deviceClass;
}

/// One error, already scrubbed and trimmed, waiting on the phone to be sent.
class ErrorReport {
  const ErrorReport({
    required this.kind,
    required this.message,
    required this.atMs,
    required this.run,
    this.stack = '',
    this.screen,
    this.count = 1,
    this.appVersion,
    this.build,
    this.platform = 'other',
    this.osVersion,
    this.deviceClass = 'other',
  });

  factory ErrorReport.fromJson(Map<String, Object?> j) => ErrorReport(
        kind: ErrorKinds.all.contains(j['kind']) ? j['kind']! as String : ErrorKinds.other,
        message: (j['message'] as String?) ?? '',
        stack: (j['stack'] as String?) ?? '',
        screen: j['screen'] as String?,
        count: ((j['count'] as num?)?.toInt() ?? 1).clamp(1, 1000),
        atMs: (j['atMs'] as num?)?.toInt() ?? 0,
        run: (j['run'] as num?)?.toInt() ?? 0,
        appVersion: j['appVersion'] as String?,
        build: j['build'] as String?,
        platform: (j['platform'] as String?) ?? 'other',
        osVersion: j['osVersion'] as String?,
        deviceClass: (j['deviceClass'] as String?) ?? 'other',
      );

  /// Builds a report from a raw error: scrubs and trims the text before anything is kept.
  factory ErrorReport.fromError(
    Object error,
    StackTrace? stack, {
    required String kind,
    required int atMs,
    required int run,
    String? screen,
    DeviceFacts facts = const DeviceFacts(),
  }) {
    String text;
    try {
      text = error.toString();
    } on Object {
      text = 'Error whose text could not be read';
    }
    final message = trimChars(scrubErrorText(text).trim(), maxMessageChars).trim();
    final stackText = stack == null ? '' : trimUtf8Bytes(scrubErrorText(stack.toString()).trim(), maxStackBytes);
    return ErrorReport(
      kind: ErrorKinds.all.contains(kind) ? kind : ErrorKinds.other,
      message: message.isEmpty ? 'Error without a message' : message,
      stack: stackText,
      screen: cleanScreen(screen),
      atMs: atMs,
      run: run,
      appVersion: facts.appVersion,
      build: facts.build,
      platform: facts.platform,
      osVersion: facts.osVersion,
      deviceClass: facts.deviceClass,
    );
  }

  final String kind;
  final String message;
  final String stack;
  final String? screen;
  final int count;

  /// When it happened on this phone. Used only to drop old reports; never sent.
  final int atMs;

  /// The process this report came from, so facts that were not known yet are only filled in for
  /// reports of the running app, never for ones kept from before an update.
  final int run;
  final String? appVersion;
  final String? build;
  final String platform;
  final String? osVersion;
  final String deviceClass;

  /// The same failure again: kind, shape of the message and the first frame, digits removed.
  String get key {
    String shape(String s) => s.replaceAll(RegExp(r'0x[0-9a-fA-F]+'), '#').replaceAll(RegExp(r'\d+'), '#').replaceAll(RegExp(r'\s+'), ' ').trim().toLowerCase();
    final letters = RegExp('[A-Za-z]');
    final frame = stack.split('\n').map((l) => l.trim()).firstWhere((l) => l.isNotEmpty && letters.hasMatch(l), orElse: () => '');
    return '$kind|${shape(message)}|${shape(frame)}';
  }

  ErrorReport copyWith({int? count, DeviceFacts? facts}) => ErrorReport(
        kind: kind,
        message: message,
        stack: stack,
        screen: screen,
        count: count ?? this.count,
        atMs: atMs,
        run: run,
        appVersion: facts?.appVersion ?? appVersion,
        build: facts?.build ?? build,
        platform: facts == null ? platform : facts.platform,
        osVersion: facts?.osVersion ?? osVersion,
        deviceClass: facts == null ? deviceClass : facts.deviceClass,
      );

  /// What goes on disk.
  Map<String, Object?> toJson() => {
        'kind': kind,
        'message': message,
        'stack': stack,
        if (screen != null) 'screen': screen,
        'count': count,
        'atMs': atMs,
        'run': run,
        if (appVersion != null) 'appVersion': appVersion,
        if (build != null) 'build': build,
        'platform': platform,
        if (osVersion != null) 'osVersion': osVersion,
        'deviceClass': deviceClass,
      };

  /// The shape `POST /api/app/errors` takes. No time, no user, no device id.
  Map<String, Object?> toWire() => {
        'kind': kind,
        'message': message,
        if (stack.isNotEmpty) 'stack': stack,
        if (screen != null) 'screen': screen,
        'count': count,
        'platform': platform,
        'device_class': deviceClass,
        if (appVersion != null) 'app_version': appVersion,
        if (build != null) 'build': build,
        if (osVersion != null) 'os_version': osVersion,
      };
}

String encodeReports(List<ErrorReport> reports) => jsonEncode([for (final r in reports) r.toJson()]);

List<ErrorReport> decodeReports(String? raw) {
  if (raw == null || raw.isEmpty) return [];
  try {
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return [
      for (final item in decoded)
        if (item is Map) ErrorReport.fromJson(Map<String, Object?>.from(item)),
    ];
  } on Object {
    return [];
  }
}
