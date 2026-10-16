import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// "Find a college" above the ladder: one field, 52 dp, a clear key (a 48 dp target) once
/// something is typed. It never takes the keyboard by itself: the ladder is read first, and the
/// student taps the field when they want it. The text only filters, so nothing here waits on a
/// reply and typing never lags.
class CollegeSearchField extends StatelessWidget {
  const CollegeSearchField({super.key, required this.controller, required this.onChanged, this.focusNode});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    OutlineInputBorder border(Color c, double w) => OutlineInputBorder(borderRadius: MmRadius.keyAll, borderSide: BorderSide(color: c, width: w));
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) => TextField(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        // The search key puts the keyboard away: the pinned Continue comes back.
        onSubmitted: (_) => FocusScope.of(context).unfocus(),
        textInputAction: TextInputAction.search,
        textCapitalization: TextCapitalization.words,
        autocorrect: false,
        enableSuggestions: false,
        cursorColor: colors.ink,
        style: type.body.copyWith(color: colors.ink),
        decoration: InputDecoration(
          hintText: OnboardingCopy.findCollege,
          hintStyle: type.body.copyWith(color: colors.ink3),
          prefixIcon: Icon(LucideIcons.search, size: 18, color: colors.ink3),
          suffixIcon: value.text.isEmpty
              ? null
              : MmPressable(
                  semanticsLabel: OnboardingCopy.clearSearch,
                  onTap: () {
                    controller.clear();
                    onChanged('');
                  },
                  pressedScale: 0.9,
                  builder: (context, pressed, _) => SizedBox.square(
                    dimension: 48,
                    child: Center(child: Icon(LucideIcons.x, size: 18, color: pressed ? colors.ink3 : colors.ink2)),
                  ),
                ),
          filled: true,
          fillColor: colors.sunken,
          isDense: true,
          constraints: const BoxConstraints(minHeight: 52),
          contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
          enabledBorder: border(colors.line, 1),
          focusedBorder: border(colors.focusRing, 1.5),
        ),
      ),
    );
  }
}
