import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/platform/share_image.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../sheet/paper.dart';

/// The answer sheet as something to keep: the student's own sheet with every answered bubble inked
/// and the blanks left open, the mock and the day. Private like every share card in the app: no
/// marks, nothing right or wrong, no chapters. The subject is an extra the student turns on.
class SheetShareCard extends StatelessWidget {
  const SheetShareCard({super.key, required this.model, this.showSubject = false});

  /// 360 by 450 logical pixels: a 1080 by 1350 image at 3x.
  static const Size size = Size(360, 450);

  final RecapModel model;
  final bool showSubject;

  /// Answered or not, never right or wrong.
  static List<BubbleState> answeredCells(List<BubbleState> cells) => [
    for (final c in cells) (c == BubbleState.blank || c == BubbleState.hollow) ? BubbleState.hollow : BubbleState.filled,
  ];

  static int answered(List<BubbleState> cells) => answeredCells(cells).where((c) => c == BubbleState.filled).length;

  @override
  Widget build(BuildContext context) {
    final m = model;
    final count = answered(m.cells);
    return Theme(
      data: buildTheme(Brightness.dark),
      child: Builder(
        builder: (context) {
          final colors = context.mmColors;
          final type = context.mmType;
          return MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling, disableAnimations: true),
            child: SizedBox.fromSize(
              size: size,
              child: Semantics(
                label: ResultCopy.shareCardLabel(m.mockLabel, count, m.questionCount, m.submittedAt, showSubject ? m.subjectName : null),
                excludeSemantics: true,
                child: ColoredBox(
                  color: colors.ground,
                  child: Stack(
                    children: [
                      const Positioned.fill(child: LampScene()),
                      Positioned.fill(child: IgnorePointer(child: Grain(opacity: colors.grain))),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(28, 28, 28, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Wordmark(height: 24),
                                const Spacer(),
                                Text(formatDayMonthShort(m.submittedAt), style: type.label.copyWith(color: colors.ink2)),
                              ],
                            ),
                            const Spacer(),
                            Text(m.mockLabel, style: type.figureHero.copyWith(fontSize: 64, height: 0.95)),
                            if (showSubject) ...[
                              const SizedBox(height: 2),
                              Text(m.subjectName, style: type.title.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
                            ],
                            const SizedBox(height: MmSpace.s16),
                            // The sheet itself, small, tilted a little toward the lamp.
                            Transform.rotate(
                              angle: -0.018,
                              child: DecoratedBox(
                                decoration: const BoxDecoration(
                                  borderRadius: BorderRadius.all(Radius.circular(10)),
                                  boxShadow: [BoxShadow(color: Color(0x80000000), blurRadius: 24, offset: Offset(6, 14), spreadRadius: -6)],
                                ),
                                child: PaperFace(
                                  child: Padding(
                                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        Row(
                                          children: [
                                            Text(ResultCopy.answerSheet, style: type.caption.copyWith(color: colors.ink3, fontSize: 11)),
                                            const Spacer(),
                                            Text(ResultCopy.answeredOf(count, m.questionCount), style: type.caption.copyWith(color: colors.ink2, fontSize: 11)),
                                          ],
                                        ),
                                        const SizedBox(height: 10),
                                        BubbleGrid(
                                          states: answeredCells(m.cells),
                                          columns: 10,
                                          bubbleSize: m.cells.length > 60 ? 12 : 16,
                                          minGap: 4,
                                          maxGap: 14,
                                          rowGap: 8,
                                          numbers: false,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: MmSpace.s20),
                            Text('mockmob.in', style: type.caption.copyWith(color: colors.ink2)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// On card 4: the student's sheet in miniature (answered inked, blanks open) as the way to the
/// share preview. A quiet row, never the card's focal element.
class SheetKeepsakeRow extends StatelessWidget {
  const SheetKeepsakeRow({super.key, required this.model, required this.onTap});

  final RecapModel model;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final cells = SheetShareCard.answeredCells(model.cells);
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      semanticsLabel: ResultCopy.shareSheet,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 76),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Row(
            children: [
              Transform.rotate(
                angle: -0.05,
                child: NightObject(
                  child: DecoratedBox(
                    decoration: const BoxDecoration(
                      borderRadius: BorderRadius.all(Radius.circular(6)),
                      boxShadow: [BoxShadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(2, 6), spreadRadius: -4)],
                    ),
                    child: SizedBox(
                      width: 64,
                      height: 60,
                      child: PaperFace(
                        child: Padding(
                          padding: const EdgeInsets.all(7),
                          child: Center(
                            child: BubbleGrid(
                              states: cells,
                              columns: 10,
                              bubbleSize: 3.6,
                              minGap: 1.2,
                              maxGap: 1.6,
                              rowGap: 1.6,
                              numbers: false,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(ResultCopy.shareSheet, style: type.labelLarge),
                    const SizedBox(height: 2),
                    Text(ResultCopy.shareSheetHint, style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The preview sheet: the card exactly as it will be shared, the optional subject, and Share.
/// Nothing leaves the phone until the student taps Share.
Future<void> showSheetShare(BuildContext context, {required RecapModel model}) =>
    showMmSheet<void>(context: context, title: ResultCopy.shareTitle, builder: (_) => SheetSharePreview(model: model));

class SheetSharePreview extends ConsumerStatefulWidget {
  const SheetSharePreview({super.key, required this.model});

  final RecapModel model;

  @override
  ConsumerState<SheetSharePreview> createState() => _SheetSharePreviewState();
}

class _SheetSharePreviewState extends ConsumerState<SheetSharePreview> {
  final GlobalKey _boundary = GlobalKey();
  bool _showSubject = false;
  bool _busy = false;
  bool _failed = false;

  Future<void> _share() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    final surface = ref.read(shareSurfaceProvider);
    final png = await capturePng(_boundary);
    final m = widget.model;
    final shared = png != null && await surface.shareImage(png: png, name: 'mockmob-sheet.png', text: ResultCopy.shareText(m.mockLabel));
    if (!mounted) return;
    if (shared) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _busy = false;
        _failed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: DecoratedBox(
              decoration: BoxDecoration(borderRadius: MmRadius.keyAll, border: Border.all(color: colors.line)),
              child: ClipRRect(
                borderRadius: MmRadius.keyAll,
                child: FittedBox(
                  fit: BoxFit.fitWidth,
                  child: RepaintBoundary(key: _boundary, child: SheetShareCard(model: widget.model, showSubject: _showSubject)),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        MergeSemantics(
          child: Row(
            children: [
              Expanded(child: Text(ResultCopy.addSubject, style: type.body)),
              Switch(value: _showSubject, onChanged: _busy ? null : (v) => setState(() => _showSubject = v)),
            ],
          ),
        ),
        if (_failed) ...[
          const SizedBox(height: MmSpace.s8),
          Text(ResultCopy.shareFailed, style: type.small.copyWith(color: colors.badText)),
        ],
        const SizedBox(height: MmSpace.s16),
        KeyButton(label: ResultCopy.share, onPressed: _busy ? null : () => unawaited(_share()), loading: _busy),
        Align(child: KeyButton.quiet(label: ResultCopy.notNow, onPressed: () => Navigator.of(context).maybePop())),
      ],
    );
  }
}
