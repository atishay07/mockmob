import 'dart:async';

import 'package:flutter/widgets.dart';

/// Shows nothing for [delay] (the space stays reserved), then [child]. A quote that arrives
/// within 400 ms never flashes a placeholder; a slow one shows the static skeleton and the
/// layout does not move when the answer lands.
class DelayedSkeleton extends StatefulWidget {
  const DelayedSkeleton({super.key, required this.child, required this.height, this.delay = const Duration(milliseconds: 400)});

  final Widget child;
  final double height;
  final Duration delay;

  @override
  State<DelayedSkeleton> createState() => _DelayedSkeletonState();
}

class _DelayedSkeletonState extends State<DelayedSkeleton> {
  Timer? _timer;
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.delay, () {
      if (mounted) setState(() => _visible = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(height: widget.height, child: _visible ? widget.child : null);
  }
}
