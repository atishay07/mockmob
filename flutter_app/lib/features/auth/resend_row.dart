import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';

/// "Resend code in 0:30" counting down in tabular figures, then a quiet "Resend code" key.
/// While a code is being sent it says so. The row keeps one height in all three states, so
/// nothing below it jumps when the cooldown ends.
class ResendRow extends StatefulWidget {
  const ResendRow({
    super.key,
    required this.availableAt,
    required this.now,
    required this.sending,
    required this.onResend,
  });

  /// When the next code may be asked for. Null means now.
  final DateTime? availableAt;
  final DateTime Function() now;
  final bool sending;
  final VoidCallback onResend;

  @override
  State<ResendRow> createState() => _ResendRowState();
}

class _ResendRowState extends State<ResendRow> {
  Timer? _timer;

  int get _remaining {
    final at = widget.availableAt;
    if (at == null) return 0;
    final ms = at.difference(widget.now()).inMilliseconds;
    return ms <= 0 ? 0 : (ms / 1000).ceil();
  }

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(ResendRow old) {
    super.didUpdateWidget(old);
    _sync();
  }

  /// A one-second timer runs only while there is something to count.
  void _sync() {
    if (_remaining > 0 && _timer == null) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() {});
        if (_remaining == 0) _stop();
      });
    } else if (_remaining == 0) {
      _stop();
    }
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
  }

  @override
  void dispose() {
    _stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final remaining = _remaining;

    final Widget content;
    if (widget.sending) {
      content = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          MmSpinner(color: colors.ink2, size: 16, strokeWidth: 2),
          const SizedBox(width: MmSpace.s8),
          Text(
            AuthCopy.resending,
            style: type.label.copyWith(color: colors.ink2),
          ),
        ],
      );
    } else if (remaining > 0) {
      content = Semantics(
        label: AuthCopy.resendInSpoken(remaining),
        excludeSemantics: true,
        child: Text(
          AuthCopy.resendIn(remaining),
          style: type.label.copyWith(color: colors.ink2),
        ),
      );
    } else {
      // The quiet key carries 16 dp of inner padding; pull it back so its label lines up.
      content = Transform.translate(
        offset: const Offset(-MmSpace.s16, 0),
        child: KeyButton.quiet(
          label: AuthCopy.resend,
          onPressed: widget.onResend,
        ),
      );
    }

    return SizedBox(
      height: MmTarget.min,
      child: Align(alignment: Alignment.centerLeft, child: content),
    );
  }
}
