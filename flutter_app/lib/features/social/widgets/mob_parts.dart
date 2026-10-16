import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/motion/motion.dart';
import '../data/mob_models.dart';
import 'mob_ring.dart';

/// The 8 colour dots, each a 48 dp target around a 28 dp dot.
class ColourPicker extends StatelessWidget {
  const ColourPicker({super.key, required this.value, required this.onChanged});

  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Wrap(
      children: [
        for (var i = 0; i < MobColours.count; i++)
          Semantics(
            button: true,
            selected: i == value,
            label: 'Colour ${i + 1}',
            child: InkResponse(
              onTap: () => onChanged(i),
              radius: 24,
              child: SizedBox.square(
                dimension: MmTarget.min,
                child: Center(
                  child: AnimatedContainer(
                    duration: Motion.ui,
                    curve: Motion.out,
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: MobColours.of(context, i),
                      shape: BoxShape.circle,
                      border: Border.all(color: i == value ? colors.ink : Colors.transparent, width: 2.5),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The display-name field (P3): the only free text in the Mob.
class MobNameField extends StatelessWidget {
  const MobNameField({super.key, required this.controller, required this.label, this.error, this.onChanged});

  final TextEditingController controller;
  final String label;
  final String? error;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return TextField(
      controller: controller,
      maxLength: 18,
      onChanged: onChanged,
      textCapitalization: TextCapitalization.words,
      autocorrect: false,
      enableSuggestions: false,
      style: type.body.copyWith(color: colors.ink),
      decoration: InputDecoration(labelText: label, errorText: error, counterText: ''),
    );
  }
}

/// A card on the ground: raised, 24 dp corners, a hairline edge.
class MobCard extends StatelessWidget {
  const MobCard({super.key, required this.child, this.padding = const EdgeInsets.all(MmSpace.cardPadding)});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.line),
        boxShadow: colors.cardShadow,
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

/// The sitters' initials in join order. Never a disc for a member who has not sat (P6).
class SitterDiscs extends StatelessWidget {
  const SitterDiscs({super.key, required this.sitters, this.size = 28});

  final List<MobMember> sitters;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (sitters.isEmpty) return const SizedBox.shrink();
    return Semantics(
      label: 'Sat: ${sitters.map((m) => m.you ? 'you' : m.name).join(', ')}',
      child: Wrap(
        spacing: MmSpace.s6,
        runSpacing: MmSpace.s6,
        alignment: WrapAlignment.center,
        children: [for (final m in sitters) InitialDisc(member: m, size: size)],
      ),
    );
  }
}

/// A small inline status line under a key ("Sent this week. One note a week.").
class MobNote extends StatelessWidget {
  const MobNote(this.text, {super.key, this.center = false});

  final String text;
  final bool center;

  @override
  Widget build(BuildContext context) {
    return Text(text, textAlign: center ? TextAlign.center : TextAlign.start, style: context.mmType.small.copyWith(color: context.mmColors.ink2));
  }
}

/// A one-line message after a write, in the page (never a pop-up).
void showMobToast(BuildContext context, String message) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message), behavior: SnackBarBehavior.floating, duration: const Duration(seconds: 3)));
}
