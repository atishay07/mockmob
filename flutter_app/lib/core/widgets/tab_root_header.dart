import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../auth/auth_state.dart';
import '../router/routes.dart';
import '../theme/theme.dart';
import 'materials/edge_light.dart';
import 'pressable.dart';

/// The top row of every tab root (brief section 6): the avatar on the left opens You, then the
/// screen's title (or Today's date line), then an optional trailing widget (the week bubbles, a
/// filter). Sits under the status bar; give it the screen's gutter.
class TabRootHeader extends StatelessWidget {
  const TabRootHeader({super.key, this.title, this.overline, this.trailing, this.avatar = const YouAvatarButton()});

  /// The screen title ("Practice"), in the Bricolage title cut.
  final String? title;

  /// A small line above the title, or alone ("Tuesday, 13 October").
  final String? overline;
  final Widget? trailing;
  final Widget avatar;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          avatar,
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (overline != null) Text(overline!, style: type.caption.copyWith(color: colors.ink2)),
                if (title != null) Semantics(header: true, child: Text(title!, style: type.screenTitle, maxLines: 1, overflow: TextOverflow.ellipsis)),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
        ],
      ),
    );
  }
}

/// The avatar that opens You: the student's initial on a small glass disc with an edge light,
/// or a person glyph before a name is known. 44 dp disc in a 48 dp target.
class YouAvatarButton extends ConsumerWidget {
  const YouAvatarButton({super.key, this.onTap});

  /// Defaults to pushing `/you`.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final name = ref.watch(authSnapshotProvider.select((a) => a.name))?.trim();
    final initial = name == null || name.isEmpty ? null : name.characters.first.toUpperCase();

    return MmPressable(
      semanticsLabel: 'You, profile and settings',
      onTap: onTap ?? () => context.push(AppRoutes.you),
      builder: (context, pressed, _) => SizedBox.square(
        dimension: 48,
        child: Center(
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: colors.isNight
                    ? [Color.lerp(colors.raised2, colors.lamp, 0.10)!, colors.raised]
                    : [colors.raised, colors.raised2],
              ),
            ),
            child: CustomPaint(
              foregroundPainter: EdgeLightPainter(
                borderRadius: MmRadius.pillAll,
                top: colors.edgeTop,
                bottom: colors.edgeBottom,
                boost: pressed ? 1.6 : 1,
                sheen: false,
              ),
              child: SizedBox.square(
                dimension: 44,
                child: Center(
                  child: initial == null
                      ? Icon(LucideIcons.user, size: 20, color: colors.ink2)
                      : Text(initial, style: type.title.copyWith(fontSize: 19, height: 1, color: colors.ink)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
