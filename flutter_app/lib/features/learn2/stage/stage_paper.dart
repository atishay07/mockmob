/// The Key card as an index card from a deck (the web's R8, commit 20762eb34: stage.css and run.css R8 over keycards.css
/// `--kc-paper`; the owner on his phone, 3 Nov: the card look "is the exact same as before"):
///
///   paper    Day a warm cream stock, Night a neutral charcoal (`MmPaper`), the film grain under the words, one quiet
///            hairline and a soft shadow. No light rim
///   band     the kind is a header band across the card's top (48 dp) washed in its family's colour (`kindFamily`), a 1 dp
///            line under it, the kind word on the left (15 semibold, AA on its wash), whatever else the card says ("Back
///            from earlier", the run's "Due today") on its right in ink-2
///   ruled    the back's words sit on faint ruled lines at the back's own line height, edge to edge: the asked line on the
///            first, NCERT's words on the next, the source on the last. A journal entry keeps plain paper (its own rhythm)
///
/// Nothing new moves: the turn is the card's own.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../keycards/data/keycards_lines.dart' show KcFamily;

abstract final class StagePaper {
  /// The header band's least height on a phone.
  static const double bandHeight = 48;

  /// The card's side padding (the web's `--st-fx` on a phone).
  static const double side = 20;

  /// The space between the band, the words and the foot (the web's face gap).
  static const double gap = 14;

  /// The ruled back's pitch by its size step (`StageText.backSize`): the back's own line height, 28 dp, 26 for a long back
  /// ('l'), 25 for a very long one ('xl').
  static double pitchFor(String step) => switch (step) {
    'l' => 26,
    'xl' => 25,
    _ => 28,
  };

  /// The pitch the back is ruled at under [scaler]: [step]'s pitch scaled, never under 1.3 of the reading size [size], in whole
  /// dp (the text engine rounds each line's height to a whole dp, so a fractional pitch would drift off the lines).
  static double pitchOf(String step, double size, TextScaler scaler) => math.max(scaler.scale(pitchFor(step)), scaler.scale(size) * 1.3).roundToDouble();

  /// [style] set on the ruled lines: each line exactly [pitch] dp tall (already scaled), the glyphs centred in it.
  static TextStyle onPitch(TextStyle style, double pitch, TextScaler scaler) =>
      style.copyWith(height: pitch / scaler.scale(style.fontSize ?? 14), leadingDistribution: TextLeadingDistribution.even);

  /// A family's colours on the paper; no family is the plain band (a lesson).
  static MmBandInk ink(MmPaper paper, KcFamily? family) => switch (family) {
    null => paper.plain,
    KcFamily.meaning => paper.meaning,
    KcFamily.rule => paper.rule,
    KcFamily.parts => paper.parts,
    KcFamily.fact => paper.fact,
  };

  /// The paper's surface for a card of [radius]: the stock, the hairline and the soft shadow.
  static ShapeDecoration surface(MmPaper paper, BorderRadius radius, {bool shadow = true}) => ShapeDecoration(
    color: paper.paper,
    shape: mmShapeBorder(radius, side: BorderSide(color: paper.line)),
    shadows: shadow ? paper.shadow : null,
  );
}

/// The header band: the kind word on the left in its family's colour, [extra] on the right in ink-2 (12.5 for the run's stage
/// tag, else 13), on the family's wash with its 1 dp line under it. Full bleed: the card clips it to its rounded top.
class StageKindBand extends StatelessWidget {
  const StageKindBand({super.key, required this.kind, this.family, this.extra, this.extraSize = 13, this.side = StagePaper.side});

  /// "Definition", "Journal entry", "Lesson, 7 min".
  final String kind;

  /// Null: the plain band (a lesson).
  final KcFamily? family;

  /// "Back from earlier", "Due today".
  final String? extra;
  final double extraSize;
  final double side;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ink = StagePaper.ink(colors.paper, family);
    final word = type.label.copyWith(fontSize: 15, height: 1.25, fontWeight: FontWeight.w600, letterSpacing: 0, color: ink.text);
    final more = extra;
    return Container(
      constraints: const BoxConstraints(minHeight: StagePaper.bandHeight),
      padding: EdgeInsets.symmetric(horizontal: side, vertical: MmSpace.s6),
      alignment: Alignment.centerLeft,
      decoration: BoxDecoration(
        color: ink.band,
        border: Border(bottom: BorderSide(color: ink.line)),
      ),
      child: more == null || more.isEmpty
          ? Text(kind, style: word)
          : LayoutBuilder(
              builder: (context, c) => Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // The kind keeps its width; at a very large text size it wraps before it pushes the extra off the band.
                  ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: c.maxWidth * 0.6),
                    child: Text(kind, style: word),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Text(
                      more,
                      textAlign: TextAlign.end,
                      style: type.label.copyWith(fontSize: extraSize, height: 1.3, color: colors.ink2),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

/// A card's back on the paper: the [band] at the top, the [block] of words 14 dp under it, the [foot] at the card's foot. It
/// is at least as tall as it is given (the card fills its page) and grows with its words (the card then scrolls inside).
/// With a [pitch], the block is ruled from its top down to 14 dp above the foot, a 1 dp [rule] at the foot of every line, edge
/// to edge, with at least one empty line under the words; the block's text is set at that pitch, so it sits on the lines.
class StageRuledBack extends MultiChildRenderObjectWidget {
  StageRuledBack({super.key, required Widget band, required Widget block, required Widget foot, this.pitch, required this.rule})
    : super(children: [band, block, foot]);

  /// The line height the block is set at (already scaled); null for plain paper.
  final double? pitch;
  final Color rule;

  @override
  RenderObject createRenderObject(BuildContext context) => RenderStageRuledBack(pitch, rule);

  @override
  void updateRenderObject(BuildContext context, RenderStageRuledBack renderObject) {
    renderObject
      ..pitch = pitch
      ..rule = rule;
  }
}

class _RuledData extends ContainerBoxParentData<RenderBox> {}

class RenderStageRuledBack extends RenderBox
    with ContainerRenderObjectMixin<RenderBox, _RuledData>, RenderBoxContainerDefaultsMixin<RenderBox, _RuledData> {
  RenderStageRuledBack(this._pitch, this._rule);

  double? _pitch;
  double? get pitch => _pitch;
  set pitch(double? v) {
    if (v == _pitch) return;
    _pitch = v;
    markNeedsLayout();
  }

  Color _rule;
  set rule(Color v) {
    if (v == _rule) return;
    _rule = v;
    markNeedsPaint();
  }

  /// Where the ruling starts (the block's top) and ends (14 dp above the foot), from the top.
  double _top = 0;
  double _bottom = 0;

  /// The ruled lines' positions (the foot of each line, from the top), for tests.
  List<double> get rules {
    final p = _pitch;
    if (p == null || p <= 0) return const [];
    return [for (var y = _top + p; y <= _bottom + 0.01; y += p) y];
  }

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _RuledData) child.parentData = _RuledData();
  }

  @override
  void performLayout() {
    final w = constraints.maxWidth;
    final each = BoxConstraints.tightFor(width: w);
    final band = firstChild!;
    final block = childAfter(band)!;
    final foot = childAfter(block)!;
    band.layout(each, parentUsesSize: true);
    block.layout(each, parentUsesSize: true);
    foot.layout(each, parentUsesSize: true);
    const gap = StagePaper.gap;
    final natural = band.size.height + gap + block.size.height + (_pitch ?? 0) + gap + foot.size.height;
    final h = constraints.constrainHeight(math.max(constraints.minHeight, natural));
    (band.parentData! as _RuledData).offset = Offset.zero;
    (block.parentData! as _RuledData).offset = Offset(0, band.size.height + gap);
    (foot.parentData! as _RuledData).offset = Offset(0, h - foot.size.height);
    _top = band.size.height + gap;
    _bottom = h - foot.size.height - gap;
    size = constraints.constrain(Size(w, h));
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    final lines = rules;
    if (lines.isNotEmpty) {
      final paint = Paint()..color = _rule;
      for (final y in lines) {
        context.canvas.drawRect(Rect.fromLTWH(offset.dx, offset.dy + y - 1, size.width, 1), paint);
      }
    }
    defaultPaint(context, offset);
  }

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) => defaultHitTestChildren(result, position: position);
}
