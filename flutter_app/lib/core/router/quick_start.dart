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
import '../widgets/bar/morph_sheet_route.dart' show MorphSheetRoute;
import '../widgets/controls/chip.dart';
import '../widgets/bubbles/sheet_glyph.dart';
import '../widgets/materials/edge_light.dart';
import '../widgets/materials/light_field.dart';
import '../widgets/materials/lit_edge.dart';
import '../widgets/mobi.dart';
import '../widgets/pressable.dart';
import '../../features/practice/widgets/choice_deck.dart';
import '../../features/practice/widgets/quick_start_deck.dart';
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
///
/// [nowProvider] is a plain clock that never ticks, so the provider re-reads itself when the
/// draft stops being resumable (at its end, or at the end of the submission grace): a sheet or
/// capsule left open past 10:40 PM never offers a session that has ended (today-03).
final resumeDraftProvider = Provider.autoDispose<SessionDraft?>((ref) {
  final draft = ref.watch(latestSessionDraftProvider).value;
  final nowMs = ref.watch(nowProvider)().millisecondsSinceEpoch;
  if (draft == null || !resumableDraft(draft, sessionId: draft.sessionId, nowMs: nowMs)) return null;
  final until = draft.endsAtWallMs > nowMs ? draft.endsAtWallMs : draft.endsAtWallMs + submissionGraceMs;
  final timer = Timer(Duration(milliseconds: until - nowMs + 1), ref.invalidateSelf);
  ref.onDispose(timer.cancel);
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
/// Review make), opened as the ten-minute run. Null hides the row. `main.dart` wires it to
/// Review's index.
class QuickRepair {
  const QuickRepair({required this.location, required this.chapter, this.tenMinuteLocation});

  /// The first mistake alone, with no count.
  final String location;
  final String chapter;

  /// The same first mistake with `count` set to what ten minutes holds, or null.
  final String? tenMinuteLocation;

  /// Where both Start's "Repair the next mistake" row and the launcher's "10-min repair" open:
  /// [tenMinuteLocation], else [location].
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

/// Tonight's move as the Start sheet's hero offers it: the same move Today's hero builds, so the
/// two can never disagree. `main.dart` wires it to Today's next action.
class StartMove {
  const StartMove({required this.title, required this.location, this.kind});

  /// What the move says ("Repair 4 mistakes in Ledgers").
  final String title;
  final String location;

  /// `repair`, `practice`, `mock` or `resume`, when known. A repair hero hides the sheet's
  /// separate repair row.
  final String? kind;

  bool get isRepair => kind == 'repair';
}

final startTonightMoveProvider = Provider<StartMove?>((ref) => null);

/// The subjects Start can start in (the student's practice-supported subjects), in their order.
/// Empty hides the chips. `main.dart` wires it.
final startSubjectsProvider = Provider<List<String>>((ref) => const []);

/// The subject Start opens in when the student has not picked one in the sheet: tonight's subject.
/// `main.dart` wires it to Practice's subject.
final startDefaultSubjectProvider = Provider<String?>((ref) => null);

/// The subject the Start sheet's modes start in. It follows [startDefaultSubjectProvider] until the
/// student picks a chip, then holds that pick.
class StartSubject extends Notifier<String?> {
  @override
  String? build() => ref.watch(startDefaultSubjectProvider);

  void select(String id) => state = id;
}

final startSubjectProvider = NotifierProvider<StartSubject, String?>(StartSubject.new);

/// Where Start's modes go in a subject (null keeps the setup page's own default).
abstract final class StartLocations {
  static String quick10(String? subject) =>
      Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'count': '10', 'subject': ?subject}).toString();

  static String fullMock(String? subject) => Uri(path: AppRoutes.practiceSetup('full'), queryParameters: {'subject': ?subject}).toString();

  /// NTA mode in [subject]: the offer's own location with its subject swapped.
  static String nta(QuickNta offer, String? subject) {
    if (subject == null || subject == offer.subject) return offer.location;
    final uri = Uri.parse(offer.location);
    return uri.replace(queryParameters: {...uri.queryParameters, 'subject': subject}).toString();
  }
}

/// The Start sheet that the bar's Start key morphs into (DOCK.md section 6). Start means "go
/// now": one tap on a row starts work with good defaults (the only step left is the cost confirm
/// when credits apply). Practice means "choose": the sheet never offers a choice Practice cannot
/// make, and never browses. Rows, five at most:
///
/// 1. The hero: resume the open session, else tonight's move (the same move as Today's hero),
///    else Quick 10.
/// 2. The subject chips: which subject the modes below start in, visible before anything starts.
/// 3. Quick 10 and Full mock in that subject.
/// 4. NTA mode in that subject, with a Pro tag when the quote says so.
/// 5. Repair the next mistake, unless the hero already is a repair.
///
/// Then one quiet text key, "Choose your own in Practice", which closes the sheet and switches to
/// the Practice tab. Ask lives in Review's header now.
class QuickStartSheet extends ConsumerStatefulWidget {
  const QuickStartSheet({super.key});

  /// The title band's fill: the sheet's own tint at full strength. The sheet lets 1.5% of the
  /// page through (a faint wash, never blurred), and under the title that was still enough to
  /// ghost a line of the page's text (device re-check, 14 Oct). The band is opaque in both
  /// themes and at every glass level, like the rows, and matches the sheet's resting colour so
  /// no seam shows. Glass Off draws the sheet solid on the raised colour, so the band does too.
  @visibleForTesting
  static Color titleBandFor(MmColors colors, GlassQuality quality) =>
      quality == GlassQuality.off ? colors.raised : colors.glassTint.withValues(alpha: 1);

  /// One short line, so the heading never wraps beside Mobi and the hero starts higher. It follows
  /// the clock ("tonight" from 4 PM, "today" before), never a fixed word.
  static String titleFor(DateTime now) => "Pick ${tonightOrToday(now)}'s work";

  @override
  ConsumerState<QuickStartSheet> createState() => _QuickStartSheetState();

  /// Whether [location] is a top-level screen outside the tab shell (it has no tab beneath it,
  /// so `go` would leave nothing to go back to).
  @visibleForTesting
  static bool opensOutsideShell(String location) {
    final path = Uri.parse(location).path;
    return path == AppRoutes.ask || path == AppRoutes.examNta || path.startsWith('/run/');
  }
}

/// The sheet's state: Mobi's controller and the hero row's key. Once the sheet has landed Mobi
/// points at the recommended choice; while a finger is down Mobi looks at it, and it points
/// back at the hero when the finger lifts. Under reduced motion Mobi holds the pointing pose.
class _QuickStartSheetState extends ConsumerState<QuickStartSheet> {
  final MobiController _mobi = MobiController();
  final GlobalKey _hero = GlobalKey(debugLabel: 'quick-start-hero');
  Animation<double>? _route;
  bool _landed = false;

  /// A row has been chosen and the sheet is on its way out: further taps do nothing, so a
  /// second tap can neither pop the page under the sheet nor push a second run (today-01).
  bool _leaving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final animation = ModalRoute.of(context)?.animation;
    if (identical(animation, _route)) return;
    _route?.removeStatusListener(_onRouteStatus);
    _route = animation;
    if (animation == null || animation.isCompleted) {
      _land();
    } else {
      animation.addStatusListener(_onRouteStatus);
    }
  }

  void _onRouteStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed) _land();
  }

  void _land() {
    if (_landed) return;
    _landed = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => _pointAtHero());
  }

  void _pointAtHero() {
    if (mounted && _landed) _mobi.pointAtWidget(_hero);
  }

  @override
  void dispose() {
    _route?.removeStatusListener(_onRouteStatus);
    _mobi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    // The Resume row is decided from the live draft on the first frame; only its answer count
    // waits for the journal, so the lit edge never jumps from Quick 10 to Resume.
    final offer = ref.watch(resumeOfferProvider).value;
    final draft = offer?.draft ?? ref.watch(resumeDraftProvider);
    final answered = offer != null && draft != null && offer.draft.sessionId == draft.sessionId ? offer.answered : null;
    final now = ref.watch(nowProvider)();
    final reduced = Motion.reduced(context);

    void go(String location) {
      if (_leaving) return;
      setState(() => _leaving = true);
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
              color: QuickStartSheet.titleBandFor(context.mmColors, GlassScope.of(context)),
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
                    const SizedBox(height: MmSpace.s8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: Semantics(
                              header: true,
                              child: Text(QuickStartSheet.titleFor(now), style: type.screenTitle.copyWith(fontSize: 24), maxLines: 2, overflow: TextOverflow.ellipsis),
                            ),
                          ),
                          const SizedBox(width: MmSpace.s8),
                          // Mobi weighs the choice with the student, then points at the recommended one; it never
                          // sits in the dock itself. Small: the Quick 10 play disc is the sheet's one focal point.
                          _SettleIn(child: Mobi(pose: MobiPose.think, size: 44, controller: _mobi)),
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
                  // The choices arrive with the sheet, in order, while the glass opens; a sheet
                  // that is already up never moves them.
                  child: AbsorbPointer(
                    absorbing: _leaving,
                    child: Listener(
                      behavior: HitTestBehavior.translucent,
                      onPointerDown: (e) => _mobi.lookAt(e.position),
                      onPointerUp: (_) => _pointAtHero(),
                      onPointerCancel: (_) => _pointAtHero(),
                      child: MmStagger(
                        driver: MmStaggerDriver.route,
                        // The choices arrive once the glass has its shape (MOTION.md C8: 38% to 78%
                        // of the morph, with the route's content reveal).
                        routeStart: 0.38,
                        routeStep: 0.06,
                        routeLength: 0.4,
                        child: MmStaggerItem(
                          index: 0,
                          child: _StartRows(
                            heroKey: _hero,
                            draft: draft,
                            answered: answered,
                            go: go,
                            onPractice: () {
                              if (_leaving) return;
                              setState(() => _leaving = true);
                              final router = GoRouter.of(context);
                              Navigator.of(context).pop();
                              router.go(AppRoutes.practice);
                            },
                          ),
                        ),
                      ),
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
}

/// The sheet's rows under the title band (the row contract above).
class _StartRows extends ConsumerWidget {
  const _StartRows({required this.heroKey, required this.draft, required this.answered, required this.go, required this.onPractice});

  final GlobalKey heroKey;
  final SessionDraft? draft;
  final int? answered;
  final void Function(String location) go;
  final VoidCallback onPractice;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final move = ref.watch(startTonightMoveProvider);
    final repair = ref.watch(quickStartRepairProvider);
    final nta = ref.watch(quickStartNtaProvider);
    final subjects = ref.watch(startSubjectsProvider);
    final picked = ref.watch(startSubjectProvider);
    final subject = picked ?? (subjects.isEmpty ? null : subjects.first);
    final now = ref.watch(nowProvider)();
    final draft = this.draft;
    final answered = this.answered;
    final subjectName = subject == null ? null : subjectDisplayName(subject);

    final quick = ChoiceOption(
      id: 'quick',
      glyph: QuickStartDeck.glyphFor('quick'),
      title: 'Quick 10',
      note: subjectName == null ? '10 questions, about 10 minutes.' : '10 $subjectName questions, about 10 minutes.',
      onTap: () => go(StartLocations.quick10(subject)),
    );

    final ChoiceOption hero;
    var heroIsRepair = false;
    var quickIsHero = false;
    if (draft != null) {
      hero = ChoiceOption(
        id: 'resume',
        glyph: QuickStartDeck.glyphFor('resume'),
        // The title never changes when the answered count resolves; the count lives on the
        // note line, which already holds a sentence.
        title: 'Resume ${subjectDisplayName(draft.subject)} ${draft.isMock ? 'mock' : 'practice'}',
        note: draft.isMock
            ? 'Ends at ${formatTime12(DateTime.fromMillisecondsSinceEpoch(draft.endsAtWallMs))}.'
                  '${answered == null ? '' : ' $answered of ${draft.view.questions.length} answered.'}'
            : answered == null
            ? 'Pick up where you left off.'
            : 'Pick up at $answered of ${draft.view.questions.length}.',
        // The note keeps room for its longest form, so nothing moves when the count lands.
        noteLines: draft.isMock ? 3 : 2,
        onTap: () => go(AppRoutes.run(draft.sessionId)),
      );
    } else if (move != null) {
      heroIsRepair = move.isRepair;
      final when = tonightOrToday(now);
      hero = ChoiceOption(
        id: 'tonight',
        glyph: QuickStartDeck.glyphFor(switch (move.kind) {
          'repair' => 'repair',
          'mock' => 'mock',
          'resume' => 'resume',
          _ => 'quick',
        }),
        title: move.title,
        note: "${when[0].toUpperCase()}${when.substring(1)}'s move.",
        onTap: () => go(move.location),
      );
    } else {
      hero = quick;
      quickIsHero = true;
    }

    final full = ChoiceOption(
      id: 'mock',
      glyph: QuickStartDeck.glyphFor('mock'),
      title: 'Full mock',
      note: '50 questions, 60 minutes, timed like the exam.',
      onTap: () => go(StartLocations.fullMock(subject)),
    );
    final ntaOption = nta == null
        ? null
        : ChoiceOption(
            id: 'nta',
            glyph: QuickStartDeck.glyphFor('nta'),
            title: 'NTA mode',
            // The quote is for the default subject; the tag shows only where it is known.
            tag: nta.proOnly && (subject == null || subject == nta.subject) ? 'Pro' : null,
            note: 'The exam-day screen${subjectName == null ? '' : ' in $subjectName'}, as on the day.',
            onTap: () => go(StartLocations.nta(nta, subject)),
          );
    final repairOption = repair == null || heroIsRepair
        ? null
        : ChoiceOption(
            id: 'repair',
            glyph: QuickStartDeck.glyphFor('repair'),
            title: 'Repair the next mistake',
            note: 'A worked explanation for your next mistake, in ${repair.chapter}.',
            onTap: () => go(repair.shortcutLocation),
          );

    final modes = <ChoiceRow>[
      if (quickIsHero) ChoiceRow.wide(full) else ChoiceRow.pair(quick, full),
      if (ntaOption != null) ChoiceRow.wide(ntaOption),
      if (repairOption != null) ChoiceRow.wide(repairOption),
    ];

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ChoiceDeck(rows: [ChoiceRow.lead(hero)], onSheet: true, leadKey: heroKey, animateIn: false),
        if (subjects.length > 1) ...[
          const SizedBox(height: MmSpace.s12),
          _SubjectChips(subjects: subjects, selected: subject),
        ],
        const SizedBox(height: MmSpace.s12),
        ChoiceDeck(rows: modes, onSheet: true, animateIn: false),
        const SizedBox(height: MmSpace.s4),
        Center(
          child: TextButton(
            key: const ValueKey('start-choose-in-practice'),
            onPressed: onPractice,
            style: TextButton.styleFrom(
              minimumSize: const Size(48, 48),
              foregroundColor: colors.isNight ? colors.ink : colors.accentText,
              textStyle: type.labelLarge,
            ),
            child: const Text('Choose your own in Practice'),
          ),
        ),
      ],
    );
  }
}

/// One row of subject chips: the subject the modes start in, the current one selected.
class _SubjectChips extends ConsumerWidget {
  const _SubjectChips({required this.subjects, required this.selected});

  final List<String> subjects;
  final String? selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SingleChildScrollView(
      key: const ValueKey('start-subject-chips'),
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(
        children: [
          for (final (i, id) in subjects.indexed) ...[
            if (i > 0) const SizedBox(width: MmSpace.s8),
            MmChip(
              label: subjectDisplayName(id),
              selected: id == selected,
              onTap: () => ref.read(startSubjectProvider.notifier).select(id),
            ),
          ],
        ],
      ),
    );
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
    this.light,
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

  /// The subject's light (its field colour), pooled in the corner of a hero or tile that belongs
  /// to a subject: the lead mark of the choice, instead of a coloured tile. Null for none.
  final Color? light;

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
    final row = DecoratedBox(
      decoration: ShapeDecoration(
        color: surfaceFor(colors, pressed: pressed),
        shape: grouped ? const RoundedRectangleBorder() : const RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 68),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s12),
          child: Row(
            children: [
              SheetGlyphTile(glyph, bare: true),
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
    if (grouped) return row;
    // A row on its own: the same top edge light as the tiles, no outline.
    return CustomPaint(
      foregroundPainter: EdgeLightPainter(
        borderRadius: MmRadius.keyAll,
        top: colors.edgeTop,
        bottom: colors.edgeBottom.withValues(alpha: 0),
        sheen: false,
        boost: pressed ? 1.6 : 1,
      ),
      child: row,
    );
  }

  Widget _hero(BuildContext context, bool pressed) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: ShapeDecoration(color: surfaceFor(colors, pressed: pressed), shape: const RoundedSuperellipseBorder(borderRadius: _heroRadius)),
      child: CustomPaint(
        // The lamp pooled from the upper left, laid over the opaque fill: still opaque.
        painter: _ShapedLight(
          radius: _heroRadius,
          pools: [
            LightPool(color: colors.lamp.withValues(alpha: colors.isNight ? 0.2 : 0.16), center: const Alignment(-1.1, -1.3), radius: 0.9, aspect: 1.6),
            if (light != null)
              LightPool(color: light!.withValues(alpha: colors.isNight ? 0.9 : 0.7), center: const Alignment(1.1, 0.9), radius: 0.7, aspect: 1.5)
            else
              LightPool(color: (colors.isNight ? colors.volt : colors.accentText).withValues(alpha: 0.07), center: const Alignment(1.05, 0.2), radius: 0.5),
          ],
        ),
        foregroundPainter: EdgeLightPainter(
          borderRadius: _heroRadius,
          top: colors.edgeTop,
          bottom: colors.edgeBottom.withValues(alpha: 0),
          sheen: false,
          boost: pressed ? 1.6 : 1,
        ),
        // Editorial, not a list row: the glyph, the title and the go-disc share the top line;
        // the note runs the full width under them, so a count landing on it never wraps the
        // card taller on a narrow phone.
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 96),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s12, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    SheetGlyphTile(glyph, size: 48),
                    const SizedBox(width: MmSpace.s12 + 2),
                    Expanded(child: Text(title, style: type.cardTitle.copyWith(fontSize: 20, height: 1.2))),
                    const SizedBox(width: MmSpace.s12),
                    ExcludeSemantics(child: _GoDisc(pressed: pressed)),
                  ],
                ),
                const SizedBox(height: MmSpace.s12),
                Padding(padding: const EdgeInsetsDirectional.only(end: MmSpace.s4), child: _note(context)),
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
        painter: light == null
            ? null
            : _ShapedLight(
                radius: MmRadius.keyAll,
                pools: [LightPool(color: light!.withValues(alpha: colors.isNight ? 0.9 : 0.7), center: const Alignment(1.2, 1.2), radius: 0.9, aspect: 1.3)],
              ),
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
                SheetGlyphTile(glyph, size: 36, bare: true),
                const SizedBox(height: MmSpace.s8),
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

/// The hero's light pools, kept inside its rounded shape (a clip on the canvas, no layer).
class _ShapedLight extends CustomPainter {
  _ShapedLight({required this.radius, required List<LightPool> pools}) : _light = LightFieldPainter(pools);

  final BorderRadius radius;
  final LightFieldPainter _light;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.clipRRect(radius.toRRect(Offset.zero & size));
    _light.paint(canvas, size);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ShapedLight old) => old.radius != radius || _light.shouldRepaint(old._light);
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
