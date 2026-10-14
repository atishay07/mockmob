import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/repositories/local_scope.dart';
import '../../../core/repositories/notification_prefs_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/you_providers.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../logic/dates.dart';
import '../logic/late_night.dart';

/// The late-night line (spec 6.8) for the end of a finished session. It shows only when the
/// "Late-night lines" setting is on, the student's own clock is between 11 PM and 7 AM, and it
/// has not been shown yet tonight. The night is remembered the moment the line appears, so it
/// never repeats. It can be dismissed and never blocks anything.
class LateNightLine extends ConsumerStatefulWidget {
  const LateNightLine({super.key});

  @override
  ConsumerState<LateNightLine> createState() => _LateNightLineState();
}

class _LateNightLineState extends ConsumerState<LateNightLine> {
  bool _show = false;

  @override
  void initState() {
    super.initState();
    unawaited(_decide());
  }

  Future<void> _decide() async {
    try {
      final clock = studentClock(ref.read(nowProvider)(), ref.read(studentTimezoneProvider));
      if (lateNightLine(clock) == null) return;
      final store = ref.read(rhythmPrefsStoreProvider);
      final key = 'rhythm_late_night_${ref.read(userIdProvider) ?? 'none'}';
      final night = lateNightKey(clock);
      if (await store.getString(key) == night) return;
      await store.setString(key, night);
    } on Object {
      // Without storage the night cannot be remembered, so the line stays away rather than repeat.
      return;
    }
    if (mounted) setState(() => _show = true);
  }

  @override
  Widget build(BuildContext context) {
    final on = ref.watch(lateNightLinesProvider);
    if (!_show || !on) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s12),
      child: Semantics(
        liveRegion: true,
        container: true,
        child: Row(
          children: [
            Expanded(
              child: Text(RhythmCopy.lateNightStop, style: type.small.copyWith(color: colors.ink3)),
            ),
            KeyButton.quiet(label: RhythmCopy.lateNightDismiss, onPressed: () => setState(() => _show = false)),
          ],
        ),
      ),
    );
  }
}
