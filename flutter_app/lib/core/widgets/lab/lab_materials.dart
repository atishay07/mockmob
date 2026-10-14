import 'package:flutter/material.dart';

import '../../art/art.dart';
import '../../copy/state_words.dart';
import '../../theme/theme.dart';
import '../art/mm_art.dart';
import '../dock/split_dock.dart';
import '../inline_banner.dart';
import '../key_button.dart';
import '../materials/fake_glass.dart';
import '../materials/glass_surface.dart';
import '../materials/light_field.dart';
import '../materials/lit_edge.dart';
import '../mm_sheet.dart';
import '../receipt_line.dart';
import '../save_pill.dart';
import '../skeleton.dart';
import '../state_view.dart';

export 'lab_mobi.dart' show LabMobi;

/// The desk scene used behind glass samples.
class LabScene extends StatelessWidget {
  const LabScene({super.key, required this.height, required this.child, this.alignment = const Alignment(0, 0.35)});

  final double height;
  final Widget child;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: MmRadius.panelAll,
      child: SizedBox(
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ArtImage(MmArt.heroDesk, fit: BoxFit.cover, alignment: alignment),
            child,
          ],
        ),
      ),
    );
  }
}

/// Live glass at each quality, fake glass, the lit edge and the lamp field.
class LabMaterials extends StatelessWidget {
  const LabMaterials({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.mmType;
    Widget pane(GlassQuality q) => Expanded(
          child: GlassSurface(
            quality: q,
            borderRadius: MmRadius.keyAll,
            child: SizedBox(height: 72, child: Center(child: Text(q.name, style: t.labelLarge))),
          ),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LabScene(
          height: 200,
          child: BackdropGroup(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Row(children: [pane(GlassQuality.full), const SizedBox(width: 8), pane(GlassQuality.lite), const SizedBox(width: 8), pane(GlassQuality.off)]),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        LitEdge(
          glow: true,
          child: FakeGlass(
            child: Padding(
              padding: const EdgeInsets.all(MmSpace.cardPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Tonight's move", style: t.caption.copyWith(color: context.mmColors.ink2)),
                  const SizedBox(height: 4),
                  Text('Repair partnership, 10 minutes', style: t.cardTitle),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: MmRadius.panelAll,
          child: SizedBox(height: 120, child: ColoredBox(color: context.mmColors.ground, child: LightField.lamp(context, withVolt: true))),
        ),
      ],
    );
  }
}

/// Each subject's light field with its object.
class LabSubjects extends StatelessWidget {
  const LabSubjects({super.key});

  static const _pairs = [
    (SubjectLight.accountancy, 'accountancy', 'Accountancy'),
    (SubjectLight.businessStudies, 'business_studies', 'Business Studies'),
    (SubjectLight.economics, 'economics', 'Economics'),
    (SubjectLight.english, 'english', 'English'),
    (SubjectLight.generalTest, 'general_test', 'General Test'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (light, subject, name) in _pairs)
          ClipRRect(
            borderRadius: MmRadius.keyAll,
            child: SizedBox(
              width: 168,
              height: 132,
              child: ColoredBox(
                color: colors.ground,
                child: LightField.subject(
                  context,
                  light,
                  center: const Alignment(0.2, 0),
                  child: Stack(
                    children: [
                      Positioned(right: 4, top: 6, bottom: 26, left: 40, child: Align(alignment: Alignment.centerRight, child: SubjectEmblem(subject: subject, size: 96, framed: false))),
                      Positioned(left: 10, bottom: 8, child: Text(name, style: context.mmType.caption)),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Empty, offline and error states, banners and the small status pieces.
class LabStates extends StatelessWidget {
  const LabStates({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 380,
          child: StateView(
            kind: StateViewKind.empty,
            title: 'Nothing to repair',
            message: "Every mistake you've found is repaired. A Quick 10 finds the next one.",
            primary: StateAction('Quick 10', () {}),
          ),
        ),
        SizedBox(
          height: 380,
          child: StateView(
            kind: StateViewKind.offline,
            title: 'You are offline',
            message: 'Your answers stay on this phone and go when you are back.',
            primary: StateAction('Try again', () {}),
          ),
        ),
        const InlineBanner(message: 'Could not save your goal. Try again.', tone: BannerTone.error),
        const SizedBox(height: 8),
        const InlineBanner(message: 'Reminders are off for this phone.', tone: BannerTone.info),
        const SizedBox(height: 8),
        const InlineBanner.offlineStrip(),
        const SizedBox(height: 12),
        const Wrap(spacing: 8, runSpacing: 8, children: [
          SavePill(state: SaveState.onThisPhone),
          SavePill(state: SaveState.sending),
          SavePill(state: SaveState.saved),
        ]),
        const SizedBox(height: 12),
        const ReceiptLine(text: 'Recorded at 10:42 PM. Mock 7, Accountancy.'),
        const SizedBox(height: 6),
        const ReceiptLine(text: Receipts.notRecordedYet, recorded: false),
        const SizedBox(height: 12),
        const Skeleton.line(width: 220),
        const SizedBox(height: 8),
        const Skeleton(height: 64),
        const SizedBox(height: 12),
        Builder(
          builder: (context) => KeyButton.secondary(
            label: 'Open a glass sheet',
            onPressed: () => showMmSheet<void>(
              context: context,
              title: 'This week',
              builder: (context) => Text('Three study days so far. Rest days keep the light.', style: context.mmType.body),
            ),
          ),
        ),
      ],
    );
  }
}

/// The dock over the desk scene; taps move the lit tile.
class LabDock extends StatefulWidget {
  const LabDock({super.key});

  @override
  State<LabDock> createState() => _LabDockState();
}

class _LabDockState extends State<LabDock> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return LabScene(
      height: 180,
      alignment: const Alignment(0, 0.6),
      child: BackdropGroup(
        child: Align(
          alignment: Alignment.bottomCenter,
          child: MediaQuery.removeViewPadding(
            context: context,
            removeBottom: true,
            child: SplitDock(currentIndex: _index, showReviewDot: true, onTab: (i) => setState(() => _index = i), onStart: (_) {}),
          ),
        ),
      ),
    );
  }
}
