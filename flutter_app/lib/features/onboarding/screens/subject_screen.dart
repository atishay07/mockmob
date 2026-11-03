import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/guest_sample.dart';
import '../state/onboarding_navigation.dart';
import '../state/onboarding_providers.dart';
import '../state/subject_choices.dart';
import '../widgets/onboarding_page.dart';

/// One decision (spec 5.1.2): which paper first. The choice is kept on this phone and written to
/// the account after sign-in.
class SubjectScreen extends ConsumerStatefulWidget {
  const SubjectScreen({super.key});

  @override
  ConsumerState<SubjectScreen> createState() => _SubjectScreenState();
}

class _SubjectScreenState extends ConsumerState<SubjectScreen> {
  String? _picked;
  bool _busy = false;

  Future<void> _pick(String id) async {
    if (_busy) return;
    _busy = true;
    setState(() => _picked = id);
    try {
      // A 140 ms pressed state, then one tap has done its job.
      await Future<void>.delayed(Motion.of(context, Motion.release));
      if (!mounted) return;
      await ref.read(guestSampleProvider.notifier).chooseSubject(id);
      if (!mounted) return;
      final guest = ref.read(guestSampleProvider).asData?.value ?? GuestSample.empty;
      await context.push(afterSubjectRoute(guest));
    } finally {
      _busy = false;
      if (mounted) setState(() => _picked = null);
    }
  }

  Future<void> _openOthers(SubjectChoices choices, String? current) async {
    final id = await showMmSheet<String>(
      context: context,
      title: OnboardingCopy.otherSubjects,
      builder: (_) => OtherSubjectsList(options: choices.others, selectedId: current),
    );
    if (id != null && mounted) await _pick(id);
  }

  @override
  Widget build(BuildContext context) {
    final choices = ref.watch(subjectChoicesProvider);
    final guest = ref.watch(guestSampleProvider).asData?.value;
    final current = _picked ?? guest?.subject;
    return SubjectView(
      choices: choices,
      selectedId: current,
      onPick: _pick,
      onOthers: () => _openOthers(choices, current),
      onBack: () => context.pop(),
    );
  }
}

/// The pure layout of the subject step, rendered by the goldens.
class SubjectView extends StatelessWidget {
  const SubjectView({
    super.key,
    required this.choices,
    required this.selectedId,
    required this.onPick,
    required this.onOthers,
    this.onBack,
  });

  final SubjectChoices choices;
  final String? selectedId;
  final ValueChanged<String> onPick;
  final VoidCallback onOthers;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return OnboardingPage(
      onBack: onBack,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s8),
          Semantics(header: true, child: Text(OnboardingCopy.subjectTitle, style: type.headline)),
          const SizedBox(height: MmSpace.s24),
          for (final s in choices.commerce) ...[
            KeyButton.option(label: s.name, selected: selectedId == s.id, onPressed: () => onPick(s.id)),
            const SizedBox(height: MmSpace.s12),
          ],
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Transform.translate(
              offset: const Offset(-MmSpace.s16, 0),
              child: KeyButton.quiet(label: OnboardingCopy.otherSubjects, onPressed: onOthers),
            ),
          ),
          const SizedBox(height: MmSpace.s24),
          Text(OnboardingCopy.subjectReason, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
          Text(OnboardingCopy.sameQuestions, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
          Text(OnboardingCopy.sampleDisclaimer, style: type.small.copyWith(color: colors.ink3)),
        ],
      ),
    );
  }
}

/// The list inside the "Other subjects" sheet: the rest of the supported papers, 56 dp rows.
class OtherSubjectsList extends StatelessWidget {
  const OtherSubjectsList({super.key, required this.options, required this.selectedId});

  final List<SubjectOption> options;
  final String? selectedId;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(OnboardingCopy.otherSubjectsNote, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
        for (final s in options) ...[
          KeyButton.option(
            label: s.name,
            selected: selectedId == s.id,
            onPressed: () => Navigator.of(context).pop(s.id),
          ),
          const SizedBox(height: MmSpace.s12),
        ],
      ],
    );
  }
}
