import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A plain message where the runner cannot open a session. The work layer keeps its rule: no
/// art and no Mobi here, just the fact and the way out.
class RunnerMessage extends StatelessWidget {
  const RunnerMessage({
    super.key,
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
    this.secondaryLabel,
    this.onSecondary,
  });

  final String title;
  final String body;
  final String actionLabel;
  final VoidCallback onAction;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final padding = MediaQuery.viewPaddingOf(context);
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.s24, padding.top + MmSpace.s64, MmSpace.s24, padding.bottom + MmSpace.s24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(header: true, child: Text(title, style: type.headline)),
            const SizedBox(height: MmSpace.s12),
            Text(body, style: type.body.copyWith(color: colors.ink2)),
            const Spacer(),
            KeyButton(label: actionLabel, onPressed: onAction),
            if (secondaryLabel != null && onSecondary != null) ...[
              const SizedBox(height: MmSpace.s8),
              Center(
                child: KeyButton.quiet(label: secondaryLabel!, onPressed: onSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The restore is local and usually instant; a skeleton of the runner appears only if it takes
/// longer than 400 ms, so a fast open never flashes.
class RunnerLoading extends StatefulWidget {
  const RunnerLoading({super.key});

  @override
  State<RunnerLoading> createState() => _RunnerLoadingState();
}

class _RunnerLoadingState extends State<RunnerLoading> {
  Timer? _timer;
  bool _show = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 400), () {
      if (mounted) setState(() => _show = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final padding = MediaQuery.viewPaddingOf(context);
    return ColoredBox(
      color: colors.ground,
      child: !_show
          ? const SizedBox.expand()
          : SkeletonGroup(
              child: Padding(
                padding: EdgeInsets.fromLTRB(MmSpace.gutter, padding.top + MmSpace.s12, MmSpace.gutter, 0),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Skeleton(width: 44, height: 44, radius: 22),
                        SizedBox(width: MmSpace.s12),
                        Skeleton(width: 72, height: 28),
                        Spacer(),
                        Skeleton(width: 104, height: 44, radius: 22),
                      ],
                    ),
                    SizedBox(height: MmSpace.s24),
                    Skeleton.line(),
                    SizedBox(height: MmSpace.s32),
                    Skeleton.line(),
                    SizedBox(height: MmSpace.s8),
                    Skeleton.line(width: 220),
                    SizedBox(height: MmSpace.s32),
                    Skeleton(height: 56, radius: MmRadius.key),
                    SizedBox(height: 10),
                    Skeleton(height: 56, radius: MmRadius.key),
                    SizedBox(height: 10),
                    Skeleton(height: 56, radius: MmRadius.key),
                    SizedBox(height: 10),
                    Skeleton(height: 56, radius: MmRadius.key),
                  ],
                ),
              ),
            ),
    );
  }
}
