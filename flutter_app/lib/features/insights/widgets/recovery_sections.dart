import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/recovery_record.dart';
import 'insights_bits.dart';

/// Concept checks and the playbook, the bottom of the record page (website Progress). It reads
/// `GET /api/recovery` once when the page opens. It stays out of the way until it has something
/// true to say: nothing while the read has not started, a placeholder while it runs, one plain
/// row with Try again when it failed and nothing is on the phone.
class RecoverySections extends StatefulWidget {
  const RecoverySections({super.key, required this.state, required this.onRetry});

  final RemoteState<RecoveryRecord> state;
  final Future<void> Function() onRetry;

  /// Whether this draws anything, so the page can skip its spacing too.
  static bool shows(RemoteState<RecoveryRecord> s) => s.value != null || s.loading || s.isFailedEmpty;

  /// How long the retry row says "Trying again" at least, so a read that fails at once still
  /// shows that the tap was heard instead of changing nothing.
  static const Duration minPending = Duration(milliseconds: 700);

  @override
  State<RecoverySections> createState() => _RecoverySectionsState();
}

class _RecoverySectionsState extends State<RecoverySections> {
  bool _retrying = false;
  bool _retried = false;
  bool _sawFailure = false;

  @override
  void initState() {
    super.initState();
    _sawFailure = widget.state.isFailedEmpty;
  }

  @override
  void didUpdateWidget(RecoverySections old) {
    super.didUpdateWidget(old);
    if (widget.state.isFailedEmpty) _sawFailure = true;
  }

  Future<void> _retry() async {
    if (_retrying) return;
    setState(() {
      _retrying = true;
      _retried = true;
    });
    try {
      await Future.wait([widget.onRetry(), Future<void>.delayed(RecoverySections.minPending)]);
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final record = state.value;
    if (record == null) {
      // The row stays one row through a retry: "Trying again" in place of the message, never
      // a skeleton swapped in for a frame.
      final retrying = _retrying || (state.loading && _sawFailure);
      if (state.isFailedEmpty || retrying) {
        final offline = state.error?.isOffline ?? false;
        final message = offline
            ? InsightsCopy.recoveryOffline
            : (_retried ? InsightsCopy.recoveryFailedAgain : InsightsCopy.recoveryFailed);
        return _Failed(message: message, retrying: retrying, onRetry: _retry);
      }
      if (state.loading) return const _Loading();
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionTitle(InsightsCopy.checksHeading, caption: InsightsCopy.checksCaption),
        if (record.checks.isEmpty) const _Quiet(InsightsCopy.checksEmpty) else _Checks(checks: record.checks),
        const SizedBox(height: MmSpace.group + MmSpace.s8),
        const SectionTitle(InsightsCopy.playbookHeading, caption: InsightsCopy.playbookCaption),
        if (!record.playbookAvailable)
          const _Quiet(InsightsCopy.playbookUnavailable)
        else if (record.playbook.isEmpty)
          const _Quiet(InsightsCopy.playbookEmpty)
        else
          _Playbook(entries: record.playbook),
      ],
    );
  }
}

class _Checks extends StatelessWidget {
  const _Checks({required this.checks});

  final List<ConceptCheck> checks;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < checks.length; i++) ...[
          if (i > 0) Divider(height: 1, color: colors.line),
          Semantics(
            container: true,
            label: '${checks[i].concept}. ${checks[i].evidenceLabel} ${InsightsCopy.checkCount(checks[i].sampleSize)}.',
            excludeSemantics: true,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(checks[i].concept, style: type.labelLarge),
                        if (checks[i].evidenceLabel.isNotEmpty) Text(checks[i].evidenceLabel, style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Text(
                    InsightsCopy.checkCount(checks[i].sampleSize),
                    style: type.caption.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Playbook extends StatelessWidget {
  const _Playbook({required this.entries});

  final List<PlaybookEntry> entries;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < entries.length; i++) ...[
          if (i > 0) Divider(height: 1, color: colors.line),
          _PlaybookRow(entry: entries[i]),
        ],
      ],
    );
  }
}

class _PlaybookRow extends StatelessWidget {
  const _PlaybookRow({required this.entry});

  final PlaybookEntry entry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final saved = entry.savedAt?.toLocal();
    final when = saved == null ? null : formatDayMonthShort(saved);
    final attemptId = entry.attemptId;
    final opens = attemptId != null && attemptId.isNotEmpty;
    final reason = entry.reflection.isEmpty ? InsightsCopy.playbookNoReflection : entry.reflection;
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(entry.strategyLabel, style: type.labelLarge)),
                    if (when != null) Text(when, style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ),
                const SizedBox(height: MmSpace.s4),
                Text(reason, style: type.small.copyWith(color: entry.reflection.isEmpty ? colors.ink3 : colors.ink2)),
                const SizedBox(height: MmSpace.s6),
                Text(InsightsCopy.playbookEvidence, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
          if (opens) ...[
            const SizedBox(width: MmSpace.s8),
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s4),
              child: Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
            ),
          ],
        ],
      ),
    );
    final label = '${entry.strategyLabel}.${when == null ? '' : ' Saved $when.'} $reason ${InsightsCopy.playbookEvidence}.';
    if (!opens) return Semantics(container: true, label: label, excludeSemantics: true, child: row);
    return MmPressable(
      onTap: () => unawaited(context.push<void>(AppRoutes.result(attemptId))),
      semanticsLabel: '$label ${InsightsCopy.openSession}',
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => ConstrainedBox(constraints: const BoxConstraints(minHeight: MmTarget.min), child: row),
    );
  }
}

/// One quiet line where a list would be.
class _Quiet extends StatelessWidget {
  const _Quiet(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
        child: Text(text, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
      );
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading checks and playbook',
      child: const SkeletonGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Skeleton(width: 160, height: 24),
            SizedBox(height: MmSpace.s12),
            Skeleton(height: 56, radius: MmRadius.panel),
          ],
        ),
      ),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.message, required this.retrying, required this.onRetry});

  final String message;
  final bool retrying;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      container: true,
      liveRegion: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.raised,
          shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s12, MmSpace.s8, MmSpace.s12),
          child: Row(
            children: [
              if (retrying) ...[MmSpinner(color: colors.ink2), const SizedBox(width: MmSpace.s12)],
              Expanded(
                child: Text(retrying ? InsightsCopy.retrying : message, style: context.mmType.small.copyWith(color: retrying ? colors.ink2 : colors.ink)),
              ),
              const SizedBox(width: MmSpace.s8),
              // Same key, same place, while it works: it cannot be tapped twice.
              KeyButton.quiet(label: InsightsCopy.retry, onPressed: retrying ? null : () => unawaited(onRetry())),
            ],
          ),
        ),
      ),
    );
  }
}
