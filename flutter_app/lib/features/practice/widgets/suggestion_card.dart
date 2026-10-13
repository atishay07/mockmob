import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The one lit element at the top of Practice, kept compact so the subject tiles below lead the
/// page: the subject's object in its own light on the left, the session (title, length and
/// subject) beside it, and a volt "Start" pill. The reason from the student's own record sits
/// under it with the "Show me" pill.
class SuggestionCard extends StatelessWidget {
  const SuggestionCard({
    super.key,
    required this.subjectId,
    required this.overline,
    required this.number,
    required this.unit,
    required this.title,
    required this.reason,
    required this.actionLabel,
    required this.onAction,
    this.kicker,
    this.onShowMe,
    this.numberSemantics,
  });

  final String subjectId;
  final String overline;
  final String number;
  final String unit;
  final String title;
  final String? kicker;
  final String reason;
  final VoidCallback? onShowMe;
  final String actionLabel;
  final VoidCallback? onAction;
  final String? numberSemantics;

  static const double _object = 56;

  /// Mobi's corner figure: 48 wide, 12 from the card edge, and the text column ends 16 from it.
  /// The text keeps clear of him by this much.
  static const double _mobiInset = 48 + 12 - MmSpace.s16;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final light = SubjectLight.forSubject(subjectId) ?? SubjectLight.language;
    final art = MmArt.subjectObject(subjectId);
    final meta = [numberSemantics ?? '$number $unit', ?kicker].join(', ');

    return LitEdge(
      glow: true,
      child: MmClip(
        borderRadius: MmRadius.panelAll,
        child: ColoredBox(
          color: colors.raised,
          child: Stack(
            children: [
              // The subject's light pooled behind the object only, at the left.
              Positioned(
                left: -40,
                top: -36,
                width: 180,
                height: 170,
                child: LightField(
                  pools: [LightPool(color: light.of(Theme.of(context).brightness), center: Alignment.center, radius: 0.5)],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s16, MmSpace.s16, MmSpace.s12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        SizedBox.square(
                          dimension: _object,
                          child: art == null ? null : ArtImage(art, width: _object, height: _object),
                        ),
                        const SizedBox(width: MmSpace.s12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Padding(
                                padding: const EdgeInsets.only(right: _mobiInset),
                                child: Text(overline, style: type.caption.copyWith(color: colors.ink2)),
                              ),
                              const SizedBox(height: 2),
                              Padding(
                                padding: const EdgeInsets.only(right: _mobiInset),
                                child: Semantics(
                                  header: true,
                                  child: Text(title, style: type.labelLarge.copyWith(fontSize: 16), maxLines: 2, overflow: TextOverflow.ellipsis),
                                ),
                              ),
                              const SizedBox(height: 2),
                              // Below Mobi's feet (he ends 54 dp down), so the meta line runs full width.
                              Text(meta, style: type.caption.copyWith(color: colors.ink2)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Padding(
                                padding: const EdgeInsets.only(left: MmSpace.s4),
                                child: Text(reason, style: type.small.copyWith(color: colors.ink)),
                              ),
                              if (onShowMe != null) ShowMePill(onTap: onShowMe!, semanticsLabel: PracticeCopy.showMeSemantics),
                            ],
                          ),
                        ),
                        const SizedBox(width: MmSpace.s12),
                        KeyButton(label: actionLabel, onPressed: onAction, expanded: false, minHeight: MmTarget.min),
                      ],
                    ),
                  ],
                ),
              ),
              // Mobi stands in the corner, pointing down at the key.
              const Positioned(top: 6, right: 12, child: MobiCharacter(size: 48, entrance: MobiAct.point, seed: 17)),
            ],
          ),
        ),
      ),
    );
  }
}
