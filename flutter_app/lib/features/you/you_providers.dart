// Providers for the You feature: local settings (written to preferences), the support mailer and
// the app version. Server-backed state (goal, consent, auth) comes from the core repositories.

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/haptics/haptics.dart';
import '../../core/motion/reduced_motion.dart';
import '../../core/storage/app_prefs.dart';
import '../../core/storage/storage_providers.dart';
import 'copy.dart';

/// A boolean setting kept in preferences. Starts at [initial] and loads the saved value once
/// preferences are readable, so the first frame never waits on storage. A failed read or write
/// keeps the in-memory value: these are per-phone conveniences, nothing is authoritative.
class PrefToggle extends Notifier<bool> {
  PrefToggle({required this.initial, required this.read, required this.write});

  final bool initial;
  final Future<bool> Function(AppPrefs prefs) read;
  final Future<void> Function(AppPrefs prefs, bool value) write;

  @override
  bool build() {
    _load();
    return initial;
  }

  Future<void> _load() async {
    try {
      final saved = await read(ref.read(appPrefsProvider));
      if (ref.mounted) state = saved;
    } on Object {
      // Keep the default.
    }
  }

  Future<void> set(bool value) async {
    state = value;
    try {
      await write(ref.read(appPrefsProvider), value);
    } on Object {
      // The choice still applies for this session.
    }
  }
}

/// "Open results directly" (off by default). The result feature reads the same preference.
final openResultsDirectlyProvider = NotifierProvider<PrefToggle, bool>(
  () => PrefToggle(
    initial: false,
    read: (p) => p.openResultsDirectly(),
    write: (p, v) => p.setOpenResultsDirectly(v),
  ),
);

/// "Late-night lines" (on by default).
final lateNightLinesProvider = NotifierProvider<PrefToggle, bool>(
  () => PrefToggle(
    initial: true,
    read: (p) => p.lateNightLines(),
    write: (p, v) => p.setLateNightLines(v),
  ),
);

/// "Touch feedback": the core switch plus its saved copy.
Future<void> setTouchFeedback(WidgetRef ref, bool value) async {
  ref.read(touchFeedbackProvider.notifier).set(value);
  try {
    await ref.read(appPrefsProvider).setTouchFeedback(value);
  } on Object {
    // Applies for this session.
  }
}

/// "Reduce motion": the in-app override. Off removes the override so the phone's own setting
/// applies again.
Future<void> setReduceMotion(WidgetRef ref, bool value) async {
  ref.read(reducedMotionOverrideProvider.notifier).set(value);
  try {
    await ref.read(appPrefsProvider).setReduceMotionOverride(value ? true : null);
  } on Object {
    // Applies for this session.
  }
}

/// Opens the email app for support. Replaced in tests.
abstract interface class SupportMailer {
  Future<bool> compose();
  Future<void> copyAddress();
}

class PlatformSupportMailer implements SupportMailer {
  const PlatformSupportMailer();

  @override
  Future<bool> compose() async {
    // The address and a fixed subject only: no account data goes into the link.
    final uri = Uri(
      scheme: 'mailto',
      path: YouCopy.supportEmail,
      queryParameters: {'subject': YouCopy.supportMailSubject},
    );
    try {
      return await launchUrl(uri);
    } on Object {
      return false;
    }
  }

  @override
  Future<void> copyAddress() => Clipboard.setData(const ClipboardData(text: YouCopy.supportEmail));
}

final supportMailerProvider = Provider<SupportMailer>((ref) => const PlatformSupportMailer());

/// "1.0.0 (1)", or null when the platform cannot say.
final appVersionProvider = FutureProvider<String?>((ref) async {
  try {
    final info = await PackageInfo.fromPlatform();
    return info.buildNumber.isEmpty ? info.version : '${info.version} (${info.buildNumber})';
  } on Object {
    return null;
  }
});
