import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// The phone's bottom screen corner radius (GLASS-1017 section 5.7), read once before the first
/// frame through the `in.mockmob.app/device` channel (Android 12 and later report it). A floating
/// sheet sits 8 dp in from the screen's edges, so its bottom corners are concentric with the
/// phone's when their radius is the phone's minus 8.
abstract final class DeviceCorner {
  /// What we assume when the phone does not say (Android 11 and older, the web, tests): a
  /// typical modern phone's corner, which gives a 28 dp sheet corner.
  static const double fallback = 36;

  /// The sheet's inset from the screen's sides and bottom at a partial detent.
  static const double sheetInset = 8;

  /// The smallest bottom corner a floating sheet gets, so it never looks square on a phone with
  /// nearly square corners.
  static const double minSheetRadius = 20;

  static double? _radius;
  static Future<void>? _loading;

  /// The phone's corner radius in dp, or [fallback] until [load] has answered (or when it could
  /// not).
  static double get radius => _radius ?? fallback;

  /// A floating sheet's bottom corner radius for a phone corner of [device] dp.
  static double sheetRadiusFor(double? device) => math.max(minSheetRadius, (device ?? fallback) - sheetInset);

  /// The bottom corner radius of a floating sheet on this phone.
  static double get sheetRadius => sheetRadiusFor(_radius);

  /// Reads the radius once; never throws. Safe to call more than once.
  static Future<void> load() => _loading ??= _load();

  static Future<void> _load() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      final value = await const MethodChannel('in.mockmob.app/device').invokeMethod<double>('cornerRadius');
      if (value != null && value.isFinite && value > 0) _radius = value;
    } on Object {
      // Older app builds or a missing handler: keep the fallback.
    }
  }

  /// Tests: set the phone's radius, or forget it.
  @visibleForTesting
  static set debugRadius(double? value) {
    _radius = value;
    _loading = null;
  }
}
