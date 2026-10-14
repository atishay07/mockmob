import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The colour the app's status-bar scrim paints instead of the ground fade, while a screen that
/// owns its top edge (the NTA exam bar) is up. The newest screen wins; null is the plain fade.
final ValueNotifier<Color?> statusTintColor = ValueNotifier<Color?>(null);

final List<Object> _tintStack = [];
int _secureHolders = 0;
final Map<Object, Color> _tints = {};

void _publish() => statusTintColor.value = _tintStack.isEmpty ? null : _tints[_tintStack.last];

// Never during a build: the scrim listening to [statusTintColor] rebuilds on the next frame.
void _publishSoon() => WidgetsBinding.instance.addPostFrameCallback((_) => _publish());

/// Keeps the window out of screenshots, screen recordings and the recents preview (Android
/// FLAG_SECURE). A comfort: a phone without the channel just carries on.
abstract interface class SecureWindow {
  Future<void> set({required bool on});
}

class PlatformSecureWindow implements SecureWindow {
  const PlatformSecureWindow();

  static const MethodChannel _channel = MethodChannel('in.mockmob.app/secure_window');

  @override
  Future<void> set({required bool on}) async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await _channel.invokeMethod<bool>('set', on);
    } on Object {
      // No channel (tests, an older build): the exam still runs.
    }
  }
}

final secureWindowProvider = Provider<SecureWindow>((ref) => const PlatformSecureWindow());

/// Paints the status bar area in [color] (solid, no fade) for as long as this widget is up, and
/// optionally secures the window. Used by screens whose own bar runs under the status bar.
class StatusTint extends ConsumerStatefulWidget {
  const StatusTint({super.key, required this.color, required this.child, this.secure = false});

  final Color color;
  final bool secure;
  final Widget child;

  @override
  ConsumerState<StatusTint> createState() => _StatusTintState();
}

class _StatusTintState extends ConsumerState<StatusTint> {
  final Object _token = Object();
  SecureWindow? _secure;

  @override
  void initState() {
    super.initState();
    _tintStack.add(_token);
    _tints[_token] = widget.color;
    _publishSoon();
    if (widget.secure) {
      _secure = ref.read(secureWindowProvider);
      if (_secureHolders++ == 0) unawaited(_secure!.set(on: true));
    }
  }

  @override
  void didUpdateWidget(StatusTint old) {
    super.didUpdateWidget(old);
    if (old.color != widget.color) {
      _tints[_token] = widget.color;
      _publishSoon();
    }
  }

  @override
  void dispose() {
    _tintStack.remove(_token);
    _tints.remove(_token);
    // After this frame: the next screen's tint (or none) settles without a flash in between.
    _publishSoon();
    if (_secure != null && --_secureHolders == 0) unawaited(_secure!.set(on: false));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
