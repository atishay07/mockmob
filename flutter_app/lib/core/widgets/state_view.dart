import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/theme.dart';
import 'key_button.dart';
import 'mobi.dart';

enum StateViewKind { empty, error, offline }

/// A label and handler for one of the (at most two) actions of a [StateView].
class StateAction {
  const StateAction(this.label, this.onPressed);

  final String label;
  final VoidCallback onPressed;
}

/// An empty, error or offline state with a message and up to two actions (the first is the
/// primary key, the second a quiet one). Empty and error show Mobi settling once; offline shows
/// a quiet glyph instead because Mobi has no offline pose. Every ending is designed: pass the
/// recovery action here.
class StateView extends StatelessWidget {
  const StateView({
    super.key,
    required this.kind,
    required this.title,
    this.message,
    this.primary,
    this.secondary,
    this.pose = MobiPose.idle,
  }) : assert(primary != null || secondary == null, 'A secondary action needs a primary action.');

  final StateViewKind kind;
  final String title;
  final String? message;
  final StateAction? primary;
  final StateAction? secondary;
  final MobiPose pose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;

    final Widget art = switch (kind) {
      StateViewKind.offline => Icon(LucideIcons.wifiOff, size: 40, color: colors.ink3),
      StateViewKind.empty || StateViewKind.error => Mobi(pose: pose, size: 72, motion: MobiMotion.settle),
    };

    final content = Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(child: art),
              const SizedBox(height: MmSpace.s16),
              Semantics(
                header: true,
                child: Text(title, style: type.title, textAlign: TextAlign.center),
              ),
              if (message != null) ...[
                const SizedBox(height: MmSpace.s8),
                Text(message!, style: type.body.copyWith(color: colors.ink2), textAlign: TextAlign.center),
              ],
              if (primary != null) ...[
                const SizedBox(height: MmSpace.s24),
                KeyButton(label: primary!.label, onPressed: primary!.onPressed),
              ],
              if (secondary != null) ...[
                const SizedBox(height: MmSpace.s8),
                Align(child: KeyButton.quiet(label: secondary!.label, onPressed: secondary!.onPressed)),
              ],
            ],
          ),
        ),
      ),
    );

    // Centred when it fits; scrolls (never clips) at large text sizes.
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: content,
        ),
      ),
    );
  }
}
