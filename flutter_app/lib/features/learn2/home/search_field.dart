import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'home_copy.dart';

/// Learn home's one search field: 52 dp, a hairline and the soft ring on focus, a Clear key while there is text, and a
/// Cancel key beside it while it has focus, text, or a set open. Focusing it opens Find in place under it; Cancel clears
/// it, lets go of the keyboard and returns the home blocks (the caller does that in [onCancel]).
class HomeSearchField extends StatelessWidget {
  const HomeSearchField({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.placeholder,
    required this.showCancel,
    required this.onChanged,
    required this.onCancel,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final String placeholder;
  final bool showCancel;
  final ValueChanged<String> onChanged;
  final VoidCallback onCancel;

  /// The field's height and its radius, as the web's `l2f-search`.
  static const double height = 52;
  static const double radius = 14;

  /// What the field takes, as the web's `slice(0, 80)`.
  static const int maxLength = 80;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final fade = Motion.of(context, Motion.ui);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: ListenableBuilder(
            listenable: Listenable.merge([focusNode, controller]),
            builder: (context, _) {
              final focused = focusNode.hasFocus;
              final hasText = controller.text.isNotEmpty;
              final border = BorderRadius.circular(radius);
              OutlineInputBorder outline(Color c, double w) => OutlineInputBorder(borderRadius: border, borderSide: BorderSide(color: c, width: w));
              return DecoratedBox(
                // The soft ring: volt at a low wash, never a loud outline (DESIGN.md's field focus).
                decoration: BoxDecoration(borderRadius: border, boxShadow: focused ? [BoxShadow(color: colors.voltGlow, spreadRadius: 3)] : null),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: height),
                  child: Semantics(
                    textField: true,
                    label: placeholder,
                    child: TextField(
                      key: const ValueKey('lh-search'),
                      controller: controller,
                      focusNode: focusNode,
                      onChanged: onChanged,
                      textInputAction: TextInputAction.search,
                      keyboardType: TextInputType.text,
                      autocorrect: false,
                      enableSuggestions: false,
                      inputFormatters: [LengthLimitingTextInputFormatter(maxLength)],
                      // The page docks the field itself (LearnHome); a wide padding here would scroll it back down.
                      scrollPadding: const EdgeInsets.all(MmSpace.s8),
                      style: type.body.copyWith(fontWeight: FontWeight.w500),
                      cursorColor: colors.ink,
                      decoration: InputDecoration(
                        hintText: placeholder,
                        hintStyle: type.body.copyWith(fontWeight: FontWeight.w500, color: colors.ink3),
                        filled: true,
                        fillColor: colors.raised,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(vertical: 16),
                        prefixIcon: Icon(LucideIcons.search, size: 20, color: colors.ink3),
                        prefixIconConstraints: const BoxConstraints(minWidth: 48, minHeight: height),
                        suffixIcon: hasText ? _ClearKey(onTap: () => _clear()) : null,
                        suffixIconConstraints: const BoxConstraints(minWidth: MmTarget.min, minHeight: height),
                        enabledBorder: outline(colors.lineStrong, 1),
                        focusedBorder: outline(colors.ink3, 1.5),
                        border: outline(colors.lineStrong, 1),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        // Cancel arrives beside the field without a jump: its room opens as it fades in.
        MmSizeEase(
          duration: fade,
          curve: Motion.out,
          alignment: Alignment.centerRight,
          child: showCancel
              ? TweenAnimationBuilder<double>(
                  tween: Tween<double>(begin: 0, end: 1),
                  duration: fade,
                  curve: Motion.out,
                  builder: (context, t, child) => Opacity(opacity: t, child: child),
                  child: _CancelKey(onTap: onCancel),
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }

  void _clear() {
    controller.clear();
    onChanged('');
    focusNode.requestFocus();
  }
}

class _ClearKey extends StatelessWidget {
  const _ClearKey({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: HomeCopy.searchClear,
      focusRadius: MmRadius.pillAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        width: MmTarget.min,
        height: HomeSearchField.height,
        child: Icon(LucideIcons.x, size: 18, color: colors.ink2),
      ),
    );
  }
}

class _CancelKey extends StatelessWidget {
  const _CancelKey({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: HomeCopy.searchCancel,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minWidth: MmTarget.min, minHeight: HomeSearchField.height),
        child: Padding(
          padding: const EdgeInsets.only(left: MmSpace.s12, right: MmSpace.s4),
          child: Center(
            widthFactor: 1,
            child: Text(HomeCopy.searchCancel, style: type.labelLarge.copyWith(fontWeight: FontWeight.w700, color: colors.ink)),
          ),
        ),
      ),
    );
  }
}
