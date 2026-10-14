import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/result_actions.dart';
import '../result_copy.dart';

/// "Report a problem" under an open answer (the website's per-answer report). The student picks
/// what looks wrong; the row reads "Reported. Thank you." only after the server took it.
class ReportKey extends ConsumerStatefulWidget {
  const ReportKey({super.key, required this.build});

  /// The report for the reason the student picks.
  final ResultReport Function(String reason) build;

  @override
  ConsumerState<ReportKey> createState() => _ReportKeyState();
}

class _ReportKeyState extends ConsumerState<ReportKey> {
  bool _sending = false;

  Future<void> _open() async {
    final reason = await showMmSheet<String>(
      context: context,
      title: ResultCopy.reportTitle,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(ResultCopy.reportNote, style: sheet.mmType.small.copyWith(color: sheet.mmColors.ink2)),
          const SizedBox(height: MmSpace.s12),
          for (final r in ResultCopy.reportReasons) ...[
            MmSelectRow(title: r, selected: false, onTap: () => Navigator.of(sheet).pop(r)),
            const SizedBox(height: MmSpace.s8),
          ],
        ],
      ),
    );
    if (reason == null || !mounted) return;
    setState(() => _sending = true);
    final ok = await ref.read(reportedQuestionsProvider.notifier).send(widget.build(reason));
    if (!mounted) return;
    setState(() => _sending = false);
    if (!ok) {
      ScaffoldMessenger.maybeOf(context)
        ?..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text(ResultCopy.reportFailed), behavior: SnackBarBehavior.floating));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final qid = widget.build('').questionId;
    final done = ref.watch(reportedQuestionsProvider.select((s) => s.contains(qid)));
    if (done) {
      return Semantics(
        liveRegion: true,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.check, size: 16, color: colors.ink2),
              const SizedBox(width: MmSpace.s8),
              Text(ResultCopy.reported, style: type.label.copyWith(color: colors.ink2)),
            ],
          ),
        ),
      );
    }
    return MmPressable(
      onTap: _sending ? null : _open,
      semanticsLabel: ResultCopy.report,
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.96,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_sending)
                SizedBox.square(dimension: 18, child: MmSpinner(color: colors.ink2, size: 16))
              else
                Icon(LucideIcons.flag, size: 16, color: colors.ink2),
              const SizedBox(width: MmSpace.s8),
              Text(_sending ? ResultCopy.reporting : ResultCopy.report, style: type.label.copyWith(color: colors.ink2)),
            ],
          ),
        ),
      ),
    );
  }
}
