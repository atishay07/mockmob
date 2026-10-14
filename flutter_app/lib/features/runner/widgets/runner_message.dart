import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// A message where the runner cannot open a session: the fact and the way out. No question is
/// open here, so Mobi may stand with the message ([mobi]); the paper itself never has him.
///
/// With Mobi the message is one composition centred in the space: Mobi large, the title and the
/// line under it, and the one key at the foot. Without, it reads from the top like a page. Both
/// sit on the page gutter, like every screen of the runner.
class RunnerMessage extends StatelessWidget {
  const RunnerMessage({
    super.key,
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
    this.secondaryLabel,
    this.onSecondary,
    this.mobi,
  });

  /// Mobi's act beside the message, or null for none.
  final MobiAct? mobi;

  final String title;
  final String body;
  final String actionLabel;
  final VoidCallback onAction;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  /// Mobi's height when he stands with the message.
  static const double mobiSize = 176;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final padding = MediaQuery.viewPaddingOf(context);
    final centred = mobi != null;
    final text = <Widget>[
      Semantics(
        header: true,
        child: Text(title, style: type.headline, textAlign: centred ? TextAlign.center : TextAlign.start),
      ),
      const SizedBox(height: MmSpace.s12),
      Text(
        body,
        style: type.body.copyWith(color: colors.ink2),
        textAlign: centred ? TextAlign.center : TextAlign.start,
      ),
    ];
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          MmSpace.gutter,
          padding.top + (centred ? MmSpace.s24 : MmSpace.s48),
          MmSpace.gutter,
          padding.bottom + MmSpace.s24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (centred)
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: ExcludeSemantics(
                            child: MobiCharacter(size: mobiSize, entrance: mobi!, seed: 29),
                          ),
                        ),
                        const SizedBox(height: MmSpace.s24),
                        ...text,
                      ],
                    ),
                  ),
                ),
              )
            else ...[
              ...text,
              const Spacer(),
            ],
            const SizedBox(height: MmSpace.s16),
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
  Timer? _slow;
  bool _show = false;
  bool _slowShown = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 400), () {
      if (mounted) setState(() => _show = true);
    });
    // After 8 seconds the wait says what is slow, in words (MOTION.md 4.15).
    _slow = Timer(const Duration(seconds: 8), () {
      if (mounted) setState(() => _slowShown = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _slow?.cancel();
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
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Padding(
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
                        SizedBox(height: MmSpace.s12),
                        Skeleton(height: 56, radius: MmRadius.key),
                        SizedBox(height: MmSpace.s12),
                        Skeleton(height: 56, radius: MmRadius.key),
                        SizedBox(height: MmSpace.s12),
                        Skeleton(height: 56, radius: MmRadius.key),
                      ],
                    ),
                  ),
                  if (_slowShown)
                    Align(
                      alignment: Alignment.bottomCenter,
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, padding.bottom + MmSpace.s32),
                        child: Semantics(
                          liveRegion: true,
                          child: Text(
                            RunnerCopy.stillOpening,
                            textAlign: TextAlign.center,
                            style: context.mmType.body.copyWith(color: colors.ink2),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
