// The weekly ending card (spec 6.9): what the week that just closed held, with plain keys to
// carry on, change the goal or rest. No verdict, no comparison, nothing lost. Today hosts
// `WeeklyEndingSection`; `WeeklyEndingCard` is the pure card for goldens and other hosts.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/rhythm.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../celebration/celebration_controller.dart';
import '../celebration/celebration_event.dart';
import '../celebration/ring_sweep.dart';
import '../copy.dart';
import '../data/rhythm_providers.dart';
import '../logic/dates.dart';
import '../logic/weekly_ending.dart';
import 'rhythm_page.dart';

class WeeklyEndingCard extends StatelessWidget {
  const WeeklyEndingCard({
    super.key,
    required this.data,
    required this.onKey,
    required this.onDismiss,
    this.ring = false,
    this.busy = false,
    this.errorText,
  });

  final WeeklyEndingData data;
  final ValueChanged<EndingKey> onKey;
  final VoidCallback onDismiss;

  /// Sweep the ring (a met week, celebrations Full, first time shown).
  final bool ring;
  final bool busy;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final keep = data.keys.first;
    final others = data.keys.skip(1).toList();

    return FakeGlass(
      child: Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s12, MmSpace.s8, MmSpace.cardPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (ring) ...[const RingSweep(size: 36, label: RhythmCopy.weekDoneLabel), const SizedBox(width: MmSpace.s12)],
              Expanded(child: Semantics(header: true, child: Text(RhythmCopy.endingTitle, style: type.subhead))),
              Semantics(
                button: true,
                label: RhythmCopy.dismiss,
                excludeSemantics: true,
                onTap: busy ? null : onDismiss,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: busy ? null : onDismiss,
                  child: SizedBox(width: MmTarget.min, height: MmTarget.min, child: Icon(LucideIcons.x, size: 20, color: colors.ink2)),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(right: MmSpace.s12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(data.body, style: type.body),
                if (data.runNote != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  Text(data.runNote!, style: type.body.copyWith(color: colors.ink2)),
                ],
                if (errorText != null) ...[
                  const SizedBox(height: MmSpace.s12),
                  InlineBanner(message: errorText!, tone: BannerTone.error),
                ],
                const SizedBox(height: MmSpace.s16),
                KeyButton.secondary(label: keep.label, onPressed: busy ? null : () => onKey(keep), loading: busy),
                for (final key in others) ...[
                  const SizedBox(height: MmSpace.s4),
                  FlushQuietKey(label: key.label, onPressed: busy ? null : () => onKey(key)),
                ],
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}

/// True when [weekId] (a Monday) is the first week the student ever met: the `first_week_met`
/// milestone was earned between that Monday and the one after it.
bool isFirstWeekMet(Rhythm rhythm, String weekId) {
  final start = parseIsoDate(weekId);
  final milestone = rhythm.milestones.where((m) => m.id == 'first_week_met' && m.achievedAt != null);
  if (start == null || milestone.isEmpty) return false;
  final at = milestone.first.achievedAt!;
  final from = start.subtract(const Duration(days: 1));
  return at.isAfter(from) && at.isBefore(start.add(const Duration(days: 9)));
}

/// The Today host: shows the card for the week that just closed, runs its keys, and says what
/// was saved once the server acknowledged. Nothing shows when rhythm is off or nothing is due.
class WeeklyEndingSection extends ConsumerStatefulWidget {
  const WeeklyEndingSection({super.key});

  @override
  ConsumerState<WeeklyEndingSection> createState() => _WeeklyEndingSectionState();
}

class _WeeklyEndingSectionState extends ConsumerState<WeeklyEndingSection> {
  String? _celebratedWeek;
  String? _confirmation;
  bool _busy = false;
  String? _error;

  void _celebrate(WeeklyEndingData data) {
    if (!data.met || _celebratedWeek == data.weekId) return;
    _celebratedWeek = data.weekId;
    final rhythm = ref.read(rhythmRepositoryProvider).value;
    final event = CelebrationEvent.weekMet(
      weekStart: data.weekId,
      studyDays: data.studyDays,
      goal: data.goal,
      firstEver: rhythm != null && isFirstWeekMet(rhythm, data.weekId),
    );
    ref.read(celebrationControllerProvider.notifier).celebrate(event);
  }

  Future<void> _onKey(WeeklyEndingData data, EndingKey key) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final actions = ref.read(rhythmActionsProvider);
    String? confirmation;
    // The server write first: only its failure is "could not save".
    try {
      switch (key.action) {
        case EndingAction.keep:
          break;
        case EndingAction.raise || EndingAction.lighter || EndingAction.lower:
          await actions.saveGoal(key.goal!);
          confirmation = RhythmCopy.endingGoalNow(key.goal!);
        case EndingAction.rest:
          final until = data.restUntil!;
          await actions.pauseUntil(until);
          final date = parseIsoDate(until);
          confirmation = RhythmCopy.endingRestWeek(date == null ? until : formatDayMonthDate(date));
      }
    } on Object {
      if (mounted) {
        setState(() {
          _error = RhythmCopy.endingActionFailed;
          _busy = false;
        });
      }
      return;
    }
    // The change is saved: say so now, whatever happens to the local dismissal.
    if (mounted) setState(() => _confirmation = confirmation);
    // Remembering that the card was seen is local and best effort. If it fails the card stays,
    // with the saved line under it, and the next visit can close it.
    try {
      await actions.dismissWeeklyEnding(data);
    } on Object {
      // Nothing was lost: the goal or pause above is already saved on the server.
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(weeklyEndingProvider);
    if (data == null) {
      final done = _confirmation;
      return done == null ? const SizedBox.shrink() : ReceiptLine(text: done);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _celebrate(data);
    });
    final celebration = ref.watch(celebrationControllerProvider.select((s) => s.byScope[CelebrationScope.weeklyEnding(data.weekId)]));
    final card = WeeklyEndingCard(
      data: data,
      ring: celebration?.ring ?? false,
      busy: _busy,
      errorText: _error,
      onKey: (key) => _onKey(data, key),
      onDismiss: () => _onKey(data, const EndingKey(EndingAction.keep, '')),
    );
    final done = _confirmation;
    if (done == null) return card;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [card, const SizedBox(height: MmSpace.s8), ReceiptLine(text: done)],
    );
  }
}
