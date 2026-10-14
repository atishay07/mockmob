import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_providers.dart';
import '../copy/formatters.dart';
import '../domain/session_rules.dart';
import '../models/session_draft.dart';
import '../repositories/session_draft_repository.dart';
import '../motion/motion.dart';
import '../theme/theme.dart';
import '../widgets/dock/morph_sheet_route.dart' show MorphSheetRoute;
import '../widgets/bubbles/sheet_glyph.dart';
import '../widgets/materials/edge_light.dart';
import '../widgets/materials/light_field.dart';
import '../widgets/materials/lit_edge.dart';
import '../widgets/mobi.dart';
import '../widgets/pressable.dart';
import 'routes.dart';

export '../widgets/bubbles/sheet_glyph.dart' show SheetGlyph;

/// The open session Start offers to resume, with its answer count, or null.
class ResumeOffer {
  const ResumeOffer({required this.draft, required this.answered});

  final SessionDraft draft;
  final int answered;

  int get total => draft.view.questions.length;
}

/// The open session Start can resume, known at once from the live draft, so the sheet draws its
/// Resume row on the first frame. Its answer count follows in [resumeOfferProvider].
final resumeDraftProvider = Provider.autoDispose<SessionDraft?>((ref) {
  final draft = ref.watch(latestSessionDraftProvider).value;
  final now = ref.watch(nowProvider)();
  if (draft == null || !resumableDraft(draft, sessionId: draft.sessionId, nowMs: now.millisecondsSinceEpoch)) return null;
  return draft;
});

final resumeOfferProvider = FutureProvider.autoDispose<ResumeOffer?>((ref) async {
  final draft = ref.watch(resumeDraftProvider);
  if (draft == null) return null;
  final summary = await ref.watch(sessionDraftRepositoryProvider).summaryOf(draft);
  return ResumeOffer(draft: draft, answered: summary.answered);
});

/// Display names of the launch subjects (the catalogue lives in Practice; Start only needs the
/// four Commerce subjects and General Test).
String subjectDisplayName(String id) => switch (id) {
  'accountancy' => 'Accountancy',
  'business_studies' => 'Business Studies',
  'economics' => 'Economics',
  'english' => 'English',
  'general_test' => 'General Test',
  _ => id.isEmpty ? 'your' : id[0].toUpperCase() + id.substring(1).replaceAll('_', ' '),
};

/// Where Start's "Repair the next mistake" goes: tonight's first mistake (the pick Today and
/// Review make). Null hides the row. `main.dart` wires it to Review's index.
class QuickRepair {
  const QuickRepair({required this.location, required this.chapter, this.tenMinuteLocation});

  final String location;
  final String chapter;

  /// The same first mistake with `count` set to what ten minutes holds, or null.
  final String? tenMinuteLocation;

  /// Where the launcher's "10-min repair" opens: [tenMinuteLocation], else [location].
  String get shortcutLocation => tenMinuteLocation ?? location;
}

final quickStartRepairProvider = Provider<QuickRepair?>((ref) => null);

/// Start's "NTA mode" row: the exam-day screen in the student's practice subject, when the
/// server offers that mode. Null hides the row. `main.dart` wires it to Practice's quote.
class QuickNta {
  const QuickNta({required this.location, required this.subject, required this.proOnly});

  final String location;
  final String subject;

  /// The quote says this needs Pro: the row carries a quiet Pro tag and still opens the
  /// instructions page, which explains (there is no purchase path in the app).
  final bool proOnly;
}

final quickStartNtaProvider = Provider<QuickNta?>((ref) => null);

/// The quick-start sheet that Start morphs into, ranked instead of five equal boxes: one hero
/// choice (resume the open session when there is one, else Quick 10), the practice modes as
/// tiles (Quick 10, Full mock, NTA mode when offered), then the quieter choices in one grouped
/// list (Repair the next mistake when there is one, Ask your record), never more than five
/// choices. They arrive in order with the sheet. Costs are not here; they live on the confirm
/// sheet each choice opens.
class QuickStartSheet extends ConsumerWidget {
  const QuickStartSheet({super.key});

  /// The title band's fill: the sheet's own tint at full strength. The sheet lets 1.5% of the
  /// page through (a faint wash, never blurred), and under the title that was still enough to
  /// ghost a line of the page's text (device re-check, 14 Oct). The band is opaque in both
  /// themes and at every glass level, like the rows, and matches the sheet's resting colour so
  /// no seam shows. Glass Off draws the sheet solid on the raised colour, so the band does too.
  @visibleForTesting
  static Color titleBandFor(MmColors colors, GlassQuality quality) =>
      quality == GlassQuality.off ? colors.raised : colors.glassTint.withValues(alpha: 1);

  static String titleFor(DateTime now) => isEvening(now) ? "What's it going to be tonight?" : "Pick today's work";

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    // The Resume row is decided from the live draft on the first frame; only its answer count
    // waits for the journal, so the lit edge never jumps from Quick 10 to Resume.
    final offer = ref.watch(resumeOfferProvider).value;
    final draft = offer?.draft ?? ref.watch(resumeDraftProvider);
    final answered = offer != null && draft != null && offer.draft.sessionId == draft.sessionId ? offer.answered : null;
    final repair = ref.watch(quickStartRepairProvider);
    final nta = ref.watch(quickStartNtaProvider);
    final now = ref.watch(nowProvider)();
    final reduced = Motion.reduced(context);

    void go(String location) {
      final router = GoRouter.of(context);
      Navigator.of(context).pop();
      // Screens that sit outside the tab shell are pushed over it, so system Back returns to the
      // tab the student started from instead of closing the app. Screens that belong to a tab
      // (Practice setup, a repair under Review) keep `go`, which puts that tab under them.
      if (QuickStartSheet.opensOutsideShell(location)) {
        unawaited(router.push<void>(location));
      } else {
        router.go(location);
      }
    }

    QuickStartRow quick(QuickStartRowStyle style) => QuickStartRow(
      style: style,
      glyph: SheetGlyph.quick,
      title: 'Quick 10',
      note: '10 questions, about 10 minutes.',
      lit: style == QuickStartRowStyle.hero,
      onTap: () => go(Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'count': '10'}).toString()),
    );

    // The sheet never grows past the screen: the header stays put and the rows scroll, so no row
    // is clipped on a short phone or at large text.
    final media = MediaQuery.of(context);
    final maxHeight = (media.size.height - media.viewPadding.top - media.viewPadding.bottom - 2 * MorphSheetRoute.margin).clamp(
      0.0,
      double.infinity,
    );

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: AnimatedSize(
        duration: reduced ? Duration.zero : Motion.ui,
        curve: Motion.glide,
        alignment: Alignment.topCenter,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The title band: grab handle, title and Mobi on an opaque fill, edge to edge.
            ColoredBox(
              key: const ValueKey('quick-start-title-band'),
              color: titleBandFor(context.mmColors, GlassScope.of(context)),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // The same grab handle as every other sheet: it drags down to close.
                    Center(
                      child: SizedBox(
                        width: 36,
                        height: 4,
                        child: DecoratedBox(
                          decoration: BoxDecoration(color: context.mmColors.ink4, borderRadius: MmRadius.pillAll),
                        ),
                      ),
                    ),
                    const SizedBox(height: MmSpace.s12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: MmSpace.s4),
                              child: Semantics(header: true, child: Text(titleFor(now), style: type.screenTitle.copyWith(fontSize: 24))),
                            ),
                          ),
                          const SizedBox(width: MmSpace.s8),
                          // Mobi weighs the choice with the student; it never sits in the dock itself.
                          const _SettleIn(child: Mobi(pose: MobiPose.think, size: 52)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Flexible(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s16, 0, MmSpace.s16, MmSpace.s12),
                child: SingleChildScrollView(
                  // The choices arrive with the sheet, in order, after the glass has opened; a
                  // sheet that is already up never moves them.
                  child: MmStagger(
                    driver: MmStaggerDriver.route,
                    routeStart: 0.32,
                    routeStep: 0.07,
                    child: _ranked(
                      hero: draft != null
                          ? QuickStartRow(
                              key: const ValueKey('quick-start-resume'),
                              style: QuickStartRowStyle.hero,
                              glyph: SheetGlyph.resume,
                              // The title never changes when the answered count resolves; the count lives on the
                              // note line, which already holds a sentence.
                              title: 'Resume ${subjectDisplayName(draft.subject)} ${draft.isMock ? 'mock' : 'practice'}',
                              note: draft.isMock
                                  ? 'Ends at ${formatTime12(DateTime.fromMillisecondsSinceEpoch(draft.endsAtWallMs))}.'
                                        '${answered == null ? '' : ' $answered of ${draft.view.questions.length} answered.'}'
                                  : answered == null
                                  ? 'Pick up where you left off.'
                                  : 'Pick up at $answered of ${draft.view.questions.length}.',
                              lit: true,
                              noteLines: 2,
                              onTap: () => go(AppRoutes.run(draft.sessionId)),
                            )
                          : quick(QuickStartRowStyle.hero),
                      modes: [
                        if (draft != null) quick(QuickStartRowStyle.tile),
                        QuickStartRow(
                          style: QuickStartRowStyle.tile,
                          glyph: SheetGlyph.mock,
                          title: 'Full mock',
                          note: '50 questions, 60 minutes, timed like the exam.',
                          onTap: () => go(AppRoutes.practiceSetup('full')),
                        ),
                        if (nta != null)
                          QuickStartRow(
                            style: QuickStartRowStyle.tile,
                            glyph: SheetGlyph.exam,
                            title: nta.proOnly ? 'NTA mode, with Pro' : 'NTA mode',
                            note: 'The exam-day screen in ${subjectDisplayName(nta.subject)}: palette, Mark for Review.',
                            onTap: () => go(nta.location),
                          ),
                      ],
                      rest: [
                        if (repair != null)
                          QuickStartRow(
                            glyph: SheetGlyph.repair,
                            title: 'Repair the next mistake',
                            note: 'A worked explanation for your next mistake, in ${repair.chapter}.',
                            grouped: true,
                            onTap: () => go(repair.location),
                          ),
                        // Never more than five choices: Ask gives way to a resume.
                        if (draft == null || nta == null || repair == null)
                          QuickStartRow(
                            glyph: SheetGlyph.ask,
                            title: 'Ask your record',
                            note: 'Questions about your marks and chapters, answered from what you have done.',
                            grouped: true,
                            onTap: () => go(AppRoutes.ask),
                          ),
                      ],
                      line: context.mmColors.line,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The ranked layout: the one hero choice, the practice modes as tiles two to a row (an odd
  /// last tile spans the row), then the quieter choices as one grouped list. Each block arrives
  /// in turn.
  static Widget _ranked({required Widget hero, required List<Widget> modes, required List<Widget> rest, required Color line}) {
    var index = 0;
    final blocks = <Widget>[MmStaggerItem(index: index++, child: hero)];
    for (var i = 0; i < modes.length; i += 2) {
      blocks.add(const SizedBox(height: MmSpace.s8));
      final pair = i + 1 < modes.length;
      blocks.add(MmStaggerItem(
        index: index++,
        child: pair
            ? IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: modes[i]),
                    const SizedBox(width: MmSpace.s8),
                    Expanded(child: modes[i + 1]),
                  ],
                ),
              )
            : modes[i],
      ));
    }
    if (rest.isNotEmpty) {
      blocks.add(const SizedBox(height: MmSpace.s8));
      blocks.add(MmStaggerItem(index: index++, child: _QuickGroup(line: line, children: rest)));
    }
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: blocks);
  }

  /// Whether [location] is a top-level screen outside the tab shell (it has no tab beneath it,
  /// so `go` would leave nothing to go back to).
  @visibleForTesting
  static bool opensOutsideShell(String location) {
    final path = Uri.parse(location).path;
    return path == AppRoutes.ask || path == AppRoutes.examNta || path.startsWith('/run/');
  }
}

/// Mobi's 420 ms settle into the sheet header: rises 6 dp and grows from 0.96. Still under
/// reduced motion.
class _SettleIn extends StatelessWidget {
  const _SettleIn({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Mobi.settleDuration,
      curve: Motion.emphasized,
      child: child,
      builder: (context, t, child) => Transform.translate(
        offset: Offset(0, 6 * (1 - t)),
        child: Transform.scale(scale: 0.96 + 0.04 * t, alignment: Alignment.bottomCenter, child: child),
      ),
    );
  }
}

/// How a quick-start choice is drawn: ranked, not five equal boxes.
enum QuickStartRowStyle {
  /// A plain row (and the rows of the quieter group).
  row,

  /// The one recommended choice: taller, lamp-lit, a bigger glyph, the volt go-disc.
  hero,

  /// A practice mode, two to a row: glyph on top, title, note.
  tile,
}

/// One choice of the quick-start sheet. Every style is opaque (the sheet behind it is a faint
/// wash of the page, never blurred). The first choice carries the lit edge (the one light in the
/// sheet). A tap gives a `selectionClick`.
class QuickStartRow extends StatelessWidget {
  const QuickStartRow({
    super.key,
    required this.glyph,
    required this.title,
    required this.note,
    required this.onTap,
    this.lit = false,
    this.noteLines = 1,
    this.style = QuickStartRowStyle.row,
    this.grouped = false,
  });

  final SheetGlyph glyph;
  final String title;
  final String note;
  final VoidCallback onTap;
  final bool lit;

  /// Note lines the row always reserves. The Resume row reserves two, so its note can grow when
  /// the count lands without moving the rows below.
  final int noteLines;
  final QuickStartRowStyle style;

  /// A row inside the sheet's grouped list: no box of its own, the group draws one around all.
  final bool grouped;

  /// A row's fill. Opaque in both themes and at every glass level: the sheet behind it is a
  /// faint wash of the page (never blurred), and a row that only tinted it let the page's text
  /// show through the row (device walk-through, 14 Oct). The ink tint is laid over the sheet's own
  /// paper colour instead of over whatever is behind.
  @visibleForTesting
  static Color surfaceFor(MmColors colors, {required bool pressed}) {
    final tint = pressed ? 0.08 : (colors.isNight ? 0.04 : 0.03);
    return Color.alphaBlend(colors.ink.withValues(alpha: tint), colors.raised);
  }

  static const BorderRadius _heroRadius = BorderRadius.all(Radius.circular(22));

  @override
  Widget build(BuildContext context) {
    final radius = switch (style) {
      QuickStartRowStyle.hero => _heroRadius,
      _ when grouped => BorderRadius.zero,
      _ => MmRadius.keyAll,
    };
    return MmPressable(
      semanticsLabel: '$title. $note',
      focusRadius: radius,
      haptic: MmPressHaptic.selection,
      pressedScale: grouped ? 0.985 : (style == QuickStartRowStyle.hero ? 0.975 : Springs.pressedScale),
      onTap: onTap,
      builder: (context, pressed, _) {
        final face = switch (style) {
          QuickStartRowStyle.hero => _hero(context, pressed),
          QuickStartRowStyle.tile => _tile(context, pressed),
          QuickStartRowStyle.row => _row(context, pressed),
        };
        return lit ? LitEdge(borderRadius: radius, child: face) : face;
      },
    );
  }

  Widget _note(BuildContext context, {int? maxLines}) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: BoxConstraints(
        minHeight: noteLines <= 1 ? 0 : MediaQuery.textScalerOf(context).scale(type.caption.height! * type.caption.fontSize!) * noteLines,
      ),
      child: Text(note, style: type.caption.copyWith(color: colors.ink2), maxLines: maxLines, overflow: maxLines == null ? null : TextOverflow.ellipsis),
    );
  }

  Widget _row(BuildContext context, bool pressed) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: surfaceFor(colors, pressed: pressed),
        shape: grouped
            ? const RoundedRectangleBorder()
            : RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: colors.ink.withValues(alpha: 0.08))),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 68),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s12),
          child: Row(
            children: [
              SheetGlyphTile(glyph),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [Text(title, style: type.labelLarge), const SizedBox(height: 2), _note(context)],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero(BuildContext context, bool pressed) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: ShapeDecoration(color: surfaceFor(colors, pressed: pressed), shape: const RoundedSuperellipseBorder(borderRadius: _heroRadius)),
      child: CustomPaint(
        // The lamp pooled from the upper left, laid over the opaque fill: still opaque.
        painter: LightFieldPainter([
          LightPool(color: colors.lamp.withValues(alpha: colors.isNight ? 0.2 : 0.16), center: const Alignment(-1.1, -1.3), radius: 0.9, aspect: 1.6),
          LightPool(color: (colors.isNight ? colors.volt : colors.accentText).withValues(alpha: 0.07), center: const Alignment(1.05, 0.2), radius: 0.5),
        ]),
        foregroundPainter: EdgeLightPainter(
          borderRadius: _heroRadius,
          top: colors.edgeTop,
          bottom: colors.edgeBottom.withValues(alpha: 0),
          sheen: false,
          boost: pressed ? 1.6 : 1,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 96),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s12, MmSpace.s16),
            child: Row(
              children: [
                SheetGlyphTile(glyph, size: 48),
                const SizedBox(width: MmSpace.s12 + 2),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(title, style: type.cardTitle.copyWith(fontSize: 20, height: 1.2)),
                      const SizedBox(height: 4),
                      _note(context),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                ExcludeSemantics(child: _GoDisc(pressed: pressed)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _tile(BuildContext context, bool pressed) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: ShapeDecoration(color: surfaceFor(colors, pressed: pressed), shape: const RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll)),
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(
          borderRadius: MmRadius.keyAll,
          top: colors.edgeTop,
          bottom: colors.edgeBottom.withValues(alpha: 0),
          sheen: false,
          boost: pressed ? 1.6 : 1,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 112),
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.s12 + 2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                SheetGlyphTile(glyph, size: 36),
                const SizedBox(height: MmSpace.s12),
                Text(title, style: type.labelLarge),
                const SizedBox(height: 2),
                _note(context),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The hero's go-disc: a small volt bubble with the play glyph, the same ink as Start.
class _GoDisc extends StatelessWidget {
  const _GoDisc({required this.pressed});

  final bool pressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return AnimatedScale(
      scale: pressed ? 0.9 : 1,
      duration: pressed ? Motion.press : Motion.release,
      curve: Motion.out,
      child: CustomPaint(
        size: const Size.square(40),
        painter: _GoDiscPainter(
          fill: colors.volt,
          glyph: colors.voltInk,
        ),
      ),
    );
  }
}

class _GoDiscPainter extends CustomPainter {
  const _GoDiscPainter({required this.fill, required this.glyph});

  final Color fill;
  final Color glyph;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    canvas.drawCircle(c, r, Paint()..color = fill);
    final h = r * 0.46;
    final path = Path()
      ..moveTo(c.dx - h * 0.36, c.dy - h * 0.6)
      ..lineTo(c.dx + h * 0.62, c.dy)
      ..lineTo(c.dx - h * 0.36, c.dy + h * 0.6)
      ..close();
    canvas.drawPath(
      path,
      Paint()
        ..color = glyph
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = glyph
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_GoDiscPainter old) => old.fill != fill || old.glyph != glyph;
}

/// The quieter choices in one opaque surface, divided by an inset hairline.
class _QuickGroup extends StatelessWidget {
  const _QuickGroup({required this.children, required this.line});

  final List<Widget> children;
  final Color line;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) {
        rows.add(ColoredBox(
          color: QuickStartRow.surfaceFor(colors, pressed: false),
          child: Padding(
            padding: const EdgeInsetsDirectional.only(start: 64),
            child: SizedBox(height: 1, child: ColoredBox(color: line)),
          ),
        ));
      }
      rows.add(children[i]);
    }
    return DecoratedBox(
      position: DecorationPosition.foreground,
      decoration: ShapeDecoration(
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: colors.ink.withValues(alpha: 0.06))),
      ),
      child: ClipRSuperellipse(
        borderRadius: MmRadius.keyAll,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: rows),
      ),
    );
  }
}
