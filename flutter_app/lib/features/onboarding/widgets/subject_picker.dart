import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/subject_registry.dart';
import '../data/subjects.dart';
import '../state/answers_controller.dart';
import 'subject_row.dart';

/// Opens the full subject list: search, the practice subjects by group, and what CUET has that
/// MockMob does not offer yet. Choices land on the sheet as they are made.
Future<void> showSubjectPicker(BuildContext context) => showMmSheet<void>(
      context: context,
      title: OnboardingCopy.pickerTitle,
      heightFactor: 0.88,
      footer: (context) => KeyButton(label: OnboardingCopy.done, onPressed: () => Navigator.of(context).maybePop()),
      builder: (context) => const SubjectPicker(),
    );

class SubjectPicker extends ConsumerStatefulWidget {
  const SubjectPicker({super.key});

  @override
  ConsumerState<SubjectPicker> createState() => _SubjectPickerState();
}

class _SubjectPickerState extends ConsumerState<SubjectPicker> {
  final _query = TextEditingController();
  bool _capped = false;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chosen = ref.watch(onboardingAnswersProvider.select((a) => a.value?.subjects ?? const <SheetSubject>[]));
    final registryAsync = ref.watch(onboardingRegistryProvider);
    final registry = registryAsync.value ?? SubjectRegistry.offline;
    final q = _query.text.trim().toLowerCase();
    bool hit(String text) => q.isEmpty || text.toLowerCase().contains(q);

    final groups = <Widget>[];
    for (final g in SubjectGroup.values) {
      final rows = [for (final s in registry.offered) if (s.group == g && hit(s.searchText)) s];
      if (rows.isEmpty) continue;
      groups.add(_Header(g.label));
      for (final s in rows) {
        groups.add(_PickRow(
          subject: s,
          chosen: chosen.contains(s),
          onTap: () {
            final ok = ref.read(onboardingAnswersProvider.notifier).toggleSubject(s);
            setState(() => _capped = !ok);
          },
        ));
      }
    }
    final unoffered = [for (final u in registry.unoffered) if (hit(u.name)) u];
    final papers = [for (final u in unoffered) if (!u.language) u];
    final languages = [for (final u in unoffered) if (u.language) u];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SearchField(controller: _query, onChanged: (_) => setState(() {})),
        const SizedBox(height: MmSpace.s8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
          child: Semantics(
            liveRegion: true,
            child: Text(
              _capped ? OnboardingCopy.fiveMax : OnboardingCopy.pickerCount(chosen.length),
              style: type.small.copyWith(color: _capped ? colors.warnText : colors.ink2),
            ),
          ),
        ),
        ...groups,
        if (unoffered.isNotEmpty) ...[
          _Header(OnboardingCopy.notOfferedTitle, note: OnboardingCopy.notOfferedNote),
          if (papers.isNotEmpty) _UnofferedBlock(label: OnboardingCopy.otherPapersLabel, subjects: papers),
          if (languages.isNotEmpty) _UnofferedBlock(label: OnboardingCopy.languagesLabel, subjects: languages),
        ],
        if (groups.isEmpty && unoffered.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s24),
            child: Text(OnboardingCopy.noMatch(_query.text.trim()), style: type.body.copyWith(color: colors.ink2), textAlign: TextAlign.center),
          ),
        if (registryAsync.isLoading)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: Row(
              children: [
                MmSpinner(size: 16, color: colors.ink3),
                const SizedBox(width: MmSpace.s8),
                Text(OnboardingCopy.checkingList, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          )
        else if (!registry.live && q.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16, left: MmSpace.s4),
            child: Text(OnboardingCopy.registryOffline, style: type.caption.copyWith(color: colors.ink3)),
          ),
      ],
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    OutlineInputBorder border(Color c, double w) => OutlineInputBorder(borderRadius: MmRadius.keyAll, borderSide: BorderSide(color: c, width: w));
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      cursorColor: colors.ink,
      style: type.body.copyWith(color: colors.ink),
      decoration: InputDecoration(
        hintText: OnboardingCopy.searchHint,
        hintStyle: type.body.copyWith(color: colors.ink3),
        prefixIcon: Icon(LucideIcons.search, size: 18, color: colors.ink3),
        filled: true,
        fillColor: colors.sunken,
        isDense: true,
        constraints: const BoxConstraints(minHeight: 52),
        contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: 14),
        enabledBorder: border(colors.line, 1),
        focusedBorder: border(colors.focusRing, 1.5),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header(this.text, {this.note});

  final String text;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s20, MmSpace.s4, MmSpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(header: true, child: Text(text.toUpperCase(), style: type.caption.copyWith(color: colors.ink3, letterSpacing: 0.8, fontWeight: FontWeight.w600))),
          if (note != null) ...[
            const SizedBox(height: 2),
            Text(note!, style: type.caption.copyWith(color: colors.ink3)),
          ],
        ],
      ),
    );
  }
}

class _PickRow extends ConsumerWidget {
  const _PickRow({required this.subject, required this.chosen, required this.onTap});

  final SheetSubject subject;
  final bool chosen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: subject.label,
      checked: chosen,
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? MmSelection.fill(colors, selected: chosen, pressed: true) : (chosen ? MmSelection.fill(colors, selected: true) : Colors.transparent),
          shape: mmShapeBorder(MmRadius.keyAll),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
          child: SubjectLine(subject: subject, chosen: chosen),
        ),
      ),
    );
  }
}

/// Papers CUET has and MockMob does not offer yet, as one quiet block of names under a label:
/// listed so a student knows, never selectable, and with no object art (none would mean much).
class _UnofferedBlock extends StatelessWidget {
  const _UnofferedBlock({required this.label, required this.subjects});

  final String label;
  final List<UnofferedSubject> subjects;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final names = [for (final u in subjects) u.name];
    return Semantics(
      label: '$label: ${names.join(', ')}. ${OnboardingCopy.notOfferedShort}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s12, MmSpace.s4, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: type.small.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
            const SizedBox(height: MmSpace.s8),
            Wrap(
              spacing: MmSpace.s4,
              runSpacing: MmSpace.s4,
              children: [
                for (final n in names)
                  DecoratedBox(
                    decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.line))),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      child: Text(n, style: type.caption.copyWith(color: colors.ink3)),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
