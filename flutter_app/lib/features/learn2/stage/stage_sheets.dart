/// Sheets over the study stage (the web's `Sheet`, `StopSheet` and the feed's "This feed"; A1 3.7, A4 3.3.10):
///
///   StageSheet     a phone bottom sheet: radius 22 on top, the app's sheet glass, at most 70% of the screen, a 52 dp
///                  head with the title (Bricolage 17) and a Close key; the body scrolls when it is longer
///   StopSheet      the one stop rule: "Stop for now?", what was done ("8 of 17 done. ... Everything you did is
///                  saved."), End here (volt), Keep going (line), Leave for now (text). No guilt copy.
///   StageFeedList  "This feed": a 52 dp row per item (its number, its kind and first words on one line, its state:
///                  Now, a check, an X, a bookmark, a dot) and "End here, see how it went" at the foot
///
/// [showStageSheet] and [showStopSheet] open them on the app's sheet route (its rise, its drag to close, its scrim).
library;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/glass_surface.dart';
import '../../../core/widgets/mm_sheet.dart' show MmSheetReleaseTracker, MmSheetRoute;
import '../../../core/widgets/pressable.dart';
import 'stage_keys.dart';

/// The frame of a stage sheet.
class StageSheet extends StatelessWidget {
  const StageSheet({super.key, required this.title, required this.child, this.onClose, this.closeLabel = 'Close'});

  final String title;
  final Widget child;

  /// The head's Close; null pops the sheet.
  final VoidCallback? onClose;
  final String closeLabel;

  static const double radius = 22;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final close = onClose ?? () => Navigator.of(context).maybePop();
    return GlassSurface(
      role: GlassRole.sheet,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(radius)),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(radius)),
          border: Border(top: BorderSide(color: colors.lineStrong)),
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 52),
                child: Row(
                  children: [
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Text(title, style: type.title.copyWith(fontSize: 17, height: 1.3, letterSpacing: -0.17, wordSpacing: 0, color: colors.ink)),
                      ),
                    ),
                    const SizedBox(width: MmSpace.s12),
                    Transform.translate(
                      offset: const Offset(10, 0),
                      child: StageIconKey(icon: LucideIcons.x, size: 20, semanticsLabel: closeLabel, onTap: close),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Flexible(child: SingleChildScrollView(child: child)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Opens a [StageSheet] titled [title] around [builder]'s body on the app's sheet route.
Future<T?> showStageSheet<T>({
  required BuildContext context,
  required String title,
  required WidgetBuilder builder,
  String closeLabel = 'Close',
  bool useRootNavigator = true,
}) {
  final colors = context.mmColors;
  final navigator = Navigator.of(context, rootNavigator: useRootNavigator);
  final localizations = MaterialLocalizations.of(context);
  final reduced = Motion.reduced(context);
  final height = MediaQuery.sizeOf(context).height;
  return navigator.push(
    MmSheetRoute<T>(
      capturedThemes: InheritedTheme.capture(from: context, to: navigator.context),
      barrierLabel: localizations.scrimLabel,
      barrierOnTapHint: localizations.scrimOnTapHint(localizations.bottomSheetLabel),
      isScrollControlled: true,
      useSafeArea: false,
      backgroundColor: Colors.transparent,
      modalBarrierColor: colors.sheetScrim,
      elevation: 0,
      clipBehavior: Clip.none,
      constraints: BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: 0.7 * height),
      shape: const RoundedRectangleBorder(),
      sheetAnimationStyle: AnimationStyle(
        duration: reduced ? Motion.reducedFade : Motion.sheetIn,
        reverseDuration: reduced ? Motion.reducedFade : Motion.sheetOut,
        curve: reduced ? Curves.linear : Motion.emphasized,
        reverseCurve: reduced ? Curves.linear : Motion.drawer,
      ),
      builder: (sheet) => MmSheetReleaseTracker(child: StageSheet(title: title, closeLabel: closeLabel, child: builder(sheet))),
    ),
  );
}

/// What the student chose in "Stop for now?".
enum StageStopChoice { end, keepGoing, leave }

/// "Stop for now?": [done] of [of] and the [detail], then the three ways on. Each key calls its callback.
class StopSheet extends StatelessWidget {
  const StopSheet({
    super.key,
    required this.done,
    required this.of,
    required this.onEnd,
    required this.onKeepGoing,
    this.detail,
    this.onLeave,
    this.endLabel = 'End here, see how it went',
  });

  final int done;
  final int of;

  /// "1 of 1 question right. 1 kept in Revise."
  final String? detail;
  final VoidCallback onEnd;
  final VoidCallback onKeepGoing;

  /// "Leave for now, pick up later today"; null leaves the key out.
  final VoidCallback? onLeave;
  final String endLabel;

  /// The sheet's line: "8 of 17 done.", the detail, then "Everything you did is saved."
  static String lineFor({required int done, required int of, String? detail}) =>
      '${of > 0 ? '$done of $of done. ' : ''}${detail != null && detail.isNotEmpty ? '$detail ' : ''}Everything you did is saved.';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(lineFor(done: done, of: of, detail: detail), style: type.body.copyWith(fontSize: 14.5, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
        const SizedBox(height: 18),
        StageStepKey(label: endLabel, onTap: onEnd),
        const SizedBox(height: 10),
        StageStepKey(label: 'Keep going', onTap: onKeepGoing, tone: StageTone.line),
        if (onLeave != null) ...[
          const SizedBox(height: 10),
          Center(child: StageTextKey(label: 'Leave for now, pick up later today', onTap: onLeave)),
        ],
      ],
    );
  }
}

/// Opens "Stop for now?" and answers with the student's choice (null when the sheet was dragged away or the scrim
/// tapped: keep going). [canLeave] false leaves "Leave for now" out.
Future<StageStopChoice?> showStopSheet(
  BuildContext context, {
  required int done,
  required int of,
  String? detail,
  bool canLeave = true,
  String endLabel = 'End here, see how it went',
}) {
  return showStageSheet<StageStopChoice>(
    context: context,
    title: 'Stop for now?',
    closeLabel: 'Keep going',
    builder: (sheet) => StopSheet(
      done: done,
      of: of,
      detail: detail,
      endLabel: endLabel,
      onEnd: () => Navigator.of(sheet).pop(StageStopChoice.end),
      onKeepGoing: () => Navigator.of(sheet).pop(StageStopChoice.keepGoing),
      onLeave: canLeave ? () => Navigator.of(sheet).pop(StageStopChoice.leave) : null,
    ),
  );
}

/// A row's state in "This feed".
enum StageRowState { ahead, now, right, wrong, kept, seen }

/// One item in "This feed": its number, its kind ("Card", "Question") and its first words.
@immutable
class StageFeedRow {
  const StageFeedRow({required this.n, required this.kind, required this.words, this.state = StageRowState.ahead});

  final int n;
  final String kind;
  final String words;
  final StageRowState state;
}

/// "This feed": the rows, and "End here, see how it went" at the foot.
class StageFeedList extends StatelessWidget {
  const StageFeedList({super.key, required this.rows, required this.onPick, this.onEnd, this.endLabel = 'End here, see how it went'});

  final List<StageFeedRow> rows;

  /// A row was tapped: its index in [rows].
  final ValueChanged<int> onPick;
  final VoidCallback? onEnd;
  final String endLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, r) in rows.indexed) StageFeedRowView(row: r, onTap: () => onPick(i)),
        if (onEnd != null) ...[
          const SizedBox(height: MmSpace.s8),
          Center(child: StageTextKey(label: endLabel, onTap: onEnd)),
        ],
      ],
    );
  }
}

/// One 52 dp row of "This feed".
class StageFeedRowView extends StatelessWidget {
  const StageFeedRowView({super.key, required this.row, required this.onTap});

  final StageFeedRow row;
  final VoidCallback onTap;

  static String spokenState(StageRowState s) => switch (s) {
    StageRowState.now => ', now',
    StageRowState.right => ', right',
    StageRowState.wrong => ', not right',
    StageRowState.kept => ', kept',
    StageRowState.seen => ', seen',
    StageRowState.ahead => '',
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final Widget mark = switch (row.state) {
      StageRowState.now => Text('Now', maxLines: 1, softWrap: false, overflow: TextOverflow.visible, style: type.label.copyWith(fontSize: 12, height: 1, color: colors.accentText)),
      StageRowState.right => Icon(LucideIcons.check, size: 16, color: colors.goodText),
      StageRowState.wrong => Icon(LucideIcons.x, size: 16, color: colors.badText),
      StageRowState.kept => StageBookmark(size: 16, color: stageSelect(colors)),
      StageRowState.seen => DecoratedBox(decoration: BoxDecoration(color: colors.ink3, shape: BoxShape.circle), child: const SizedBox.square(dimension: 6)),
      StageRowState.ahead => const SizedBox.shrink(),
    };
    return MmPressable(
      onTap: onTap,
      lift: false,
      pressedScale: 0.99,
      focusRadius: BorderRadius.circular(8),
      highlight: true,
      haptic: MmPressHaptic.selection,
      semanticsLabel: '${row.n}. ${row.kind}. ${row.words}${spokenState(row.state)}',
      selected: row.state == StageRowState.now,
      builder: (context, pressed, focused) => DecoratedBox(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s6),
            child: Row(
              children: [
                SizedBox(
                  width: 30,
                  child: Text('${row.n}', style: type.label.copyWith(fontSize: 13, height: 1, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      style: type.label.copyWith(fontSize: 14.5, height: 1.3, color: colors.ink2),
                      children: [
                        TextSpan(text: '${row.kind}  ', style: TextStyle(fontSize: 12, color: colors.ink3)),
                        TextSpan(text: row.words),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(width: 28, child: Center(child: mark)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
