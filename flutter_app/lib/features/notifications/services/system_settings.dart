import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Opens Android's notification settings for MockMob (a channel to `MainActivity`). Returns
/// false where it cannot (tests, another platform, an Android that refuses the intent).
class SystemSettings {
  const SystemSettings();

  static const MethodChannel _channel = MethodChannel('in.mockmob.app/system_settings');

  Future<bool> openNotificationSettings() async {
    try {
      return await _channel.invokeMethod<bool>('openNotificationSettings') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }
}

final systemSettingsProvider = Provider<SystemSettings>((ref) => const SystemSettings());
