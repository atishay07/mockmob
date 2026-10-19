import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/ask_doors.dart';
import '../data/insights_repository.dart';
import 'ask_mobi_button.dart';
import 'mobi_mark.dart';

/// Practice's way in to Ask Mobi (ASK-MOBI-1019 B; D112): Mobi's mark, one line that says what he is for
/// and the student's own biggest leak when the record has one, then the two doors as two keys.
/// It takes the slot of the old "Ask Mobi what to practise" row: the entry moved, nothing went.
class AskMobiCard extends ConsumerWidget {
  const AskMobiCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final record = ref.watch(insightsRepositoryProvider).value;
    final lead = recordLead(record);
    final line = lead != null
        ? AskDoorCopy.cardLineHeavy(lead.lost, lead.place)
        : (record != null && record.isReady ? AskDoorCopy.cardLineRecord : AskDoorCopy.cardLineFresh);
    // The screen reads the record again as it opens.
    void open(AskDoor door) => openAskMobiScreen(context, door: door);

    return FakeGlass(
      borderRadius: const BorderRadius.all(Radius.circular(22)),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // His flat mark, not the character: Practice's own Mobi stands in the header (one Mobi a screen).
                const Padding(padding: EdgeInsets.only(top: 2), child: MobiMark(size: 44)),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(header: true, child: Text(AskDoorCopy.cardTitle, style: type.headline.copyWith(fontSize: 24, height: 27 / 24, letterSpacing: -0.3))),
                      const SizedBox(height: MmSpace.s4),
                      Text(line, style: type.body.copyWith(color: colors.ink2, fontSize: 15, height: 21 / 15)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            // Widths by their words, so "Ask your record" stays on one line at 360 dp.
            Row(
              children: [
                Expanded(flex: 5, child: KeyButton.secondary(label: AskDoorCopy.cardNow, minHeight: 52, onPressed: () => open(AskDoor.now))),
                const SizedBox(width: 10),
                Expanded(flex: 7, child: KeyButton.secondary(label: AskDoorCopy.cardRecord, minHeight: 52, onPressed: () => open(AskDoor.record))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
