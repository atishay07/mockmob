import 'package:flutter/material.dart';
import 'package:mockmob/core/widgets/lab/lab_materials.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import 'night_support.dart';

Widget _state(StateViewKind kind) => StateView(
      kind: kind,
      title: switch (kind) {
        StateViewKind.empty => 'Nothing to repair',
        StateViewKind.error => 'We could not load this week',
        StateViewKind.offline => "You're offline",
      },
      message: switch (kind) {
        StateViewKind.empty => "Every mistake you've found is repaired. A Quick 10 finds the next one.",
        StateViewKind.error => 'Your record is as you left it.',
        StateViewKind.offline => 'Your answers stay on this phone and go when you are back.',
      },
      primary: StateAction(kind == StateViewKind.empty ? 'Quick 10' : 'Try again', () {}),
      secondary: kind == StateViewKind.error ? StateAction('Go to Today', () {}) : null,
    );

class _Status extends StatelessWidget {
  const _Status();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const InlineBanner(message: 'We could not send 3 answers. They are still on this phone.', tone: BannerTone.error),
        const SizedBox(height: 8),
        InlineBanner(message: 'Reminders are paused on this phone.', actionLabel: 'Turn on', onAction: () {}),
        const SizedBox(height: 8),
        const InlineBanner(message: 'Your plan changed on another device.', tone: BannerTone.warning),
        const SizedBox(height: 8),
        const InlineBanner.offlineStrip(),
        const SizedBox(height: 16),
        const Wrap(spacing: 8, runSpacing: 8, children: [
          SavePill(state: SaveState.onThisPhone),
          SavePill(state: SaveState.sending),
          SavePill(state: SaveState.saved),
        ]),
        const SizedBox(height: 16),
        const ReceiptLine(text: 'Recorded at 10:42 PM. Mock 7, Accountancy.'),
        const SizedBox(height: 8),
        const ReceiptLine.pending(),
        const SizedBox(height: 16),
        const SkeletonGroup(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Skeleton.line(width: 180, height: 20),
            SizedBox(height: 10),
            Skeleton.line(),
            SizedBox(height: 8),
            Skeleton(height: 72),
          ]),
        ),
      ],
    );
  }
}

void main() {
  nightGolden(
    'mobi',
    () => const SingleChildScrollView(
      physics: NeverScrollableScrollPhysics(),
      padding: EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [MmMark(size: 64), SizedBox(width: 16), Wordmark(height: 40)]),
        SizedBox(height: 24),
        LabMobi(),
      ]),
    ),
  );
  nightGolden('state_empty', () => _state(StateViewKind.empty));
  nightGolden('state_offline', () => _state(StateViewKind.offline));
  nightGolden('state_error', () => _state(StateViewKind.error));
  nightGolden(
    'status',
    () => const SingleChildScrollView(physics: NeverScrollableScrollPhysics(), padding: EdgeInsets.all(16), child: _Status()),
  );
}
