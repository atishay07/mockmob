import 'package:flutter/widgets.dart';

/// Builds with whether the on-screen keyboard is up.
///
/// It reads the window's own insets, not the nearest [MediaQuery]: a Scaffold above resizes its
/// body for the keyboard and removes the inset from what its children see, so a step inside one
/// would never learn the keyboard is up. It listens for metric changes, so it rebuilds the moment
/// the keyboard opens or closes, wherever it sits.
class KeyboardWatch extends StatefulWidget {
  const KeyboardWatch({super.key, required this.builder});

  final Widget Function(BuildContext context, bool open) builder;

  @override
  State<KeyboardWatch> createState() => _KeyboardWatchState();
}

class _KeyboardWatchState extends State<KeyboardWatch> with WidgetsBindingObserver {
  bool _open = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _open = _read();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  bool _read() => View.of(context).viewInsets.bottom > 0 || (MediaQuery.maybeViewInsetsOf(context)?.bottom ?? 0) > 0;

  @override
  void didChangeMetrics() {
    if (!mounted) return;
    final open = _read();
    if (open != _open) setState(() => _open = open);
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _open);
}
