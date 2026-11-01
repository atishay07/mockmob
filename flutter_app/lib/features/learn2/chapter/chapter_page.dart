// Learn v2, the chapter page (APP-1101 section 5 C; the website's ChapterPage.jsx, chapterModel.mjs and chapter.css, phone
// band; BUILD-1101 B2 and B7; A4-chapter-run.md 3.2).
//
//   Head     a back key that says where it goes ("Learn"), the unit only when it does not repeat the title, the title, "Part 1,
//            Ch 1" and the state line, and the subject's object (it appears once, here)
//   Resume   when today's run of this chapter is unfinished: "You stopped at 6 of 16 today." and the volt "Pick up where you
//            stopped"; the Start key then turns into a line key, "Start a new 10 minutes", that sends `fresh`
//   Length   "How long have you got?": 5 min | 10 min | 20 min | Your own. The chosen segment never rewrites itself: the real
//            length is on the Start key and the reason in one quiet line under it
//   Piles    up to four paper fans (Key cards, Questions, Your mistakes, Lesson) whose minutes add up to the Start key. A tap
//            leaves a pile out; the last one in shakes and says so. Free's held piles are not buttons. A short chapter offers
//            "Add the next chapter".
//   Start    the one volt key, with the real length. It never sits under the edge of the screen: it rides there while the
//            lined-up block is on screen. One quiet line under it by priority; the quick recap as a text key.
//   Shelf    "Everything in this chapter": only rows that lead somewhere; what is missing is one quiet line.
//
// Every number on screen comes from the preview answer (chapter_preview.dart). Places come from Learn2Links, never built here.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart' show EmblemSizes, SubjectEmblem;
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../keycards/data/keycards_models.dart' show KcChapterState;
import '../../keycards/widgets/key_card_parts.dart' show KcLinkAction, KcStateLine;
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../data/learn_api.dart' show LearnError;
import '../data/learn_models.dart';
import '../data/learn_prefs.dart';
import '../data/learn_providers.dart' show learnChapterMinutesProvider;
import '../learn2_links.dart';
import 'chapter_copy.dart';
import 'chapter_length.dart';
import 'chapter_model.dart';
import 'chapter_piles.dart';
import 'chapter_preview.dart';
import 'chapter_shelf.dart';
import 'chapter_sticky.dart';

/// The chapter page (packet C): a root page over the shell, no dock.
class ChapterPage extends ConsumerStatefulWidget {
  const ChapterPage({super.key, required this.chapterKey, this.minutes});

  final String chapterKey;

  /// The length the link names (`?min=`); without one the page shows the length used last.
  final int? minutes;

  @override
  ConsumerState<ChapterPage> createState() => _ChapterPageState();
}

/// "Tap a pile to leave it out." is said once, on the first visit, and goes quiet at the first tap.
enum _Coach { hidden, shown, done }

class _ChapterPageState extends ConsumerState<ChapterPage> {
  late int _minutes;

  /// The student (or the link) chose a length: the one kept on the phone no longer replaces it.
  late bool _chose;
  List<String> _leaveOut = const [];
  bool _addNext = false;
  bool _lastIn = false;
  Timer? _lastTimer;
  _Coach _coach = _Coach.hidden;

  /// The run's length without the next chapter, so the added pile can say what it adds ("+3 min").
  int? _baseMinutes;

  /// What this phone keeps (the length used last, the first-visit line) has been read: until then the page waits, so it never
  /// opens on 10 minutes and slides to the length kept.
  bool _phoneRead = false;

  final Map<String, GlobalKey<MmShakeState>> _shakeKeys = {};
  final GlobalKey _block = GlobalKey(debugLabel: 'chapter-lined-up');

  String get _subject => widget.chapterKey.split('.').first;

  @override
  void initState() {
    super.initState();
    _chose = ChapterModel.validMinutes(widget.minutes);
    _minutes = _chose ? widget.minutes! : ChapterModel.defaultMinutes;
    unawaited(_readPhone());
  }

  @override
  void dispose() {
    _lastTimer?.cancel();
    super.dispose();
  }

  /// Returning: the length used last, shown as chosen (and editable), unless the link names one; and the one-time line. The
  /// first ask is made once this is known, for the right length.
  Future<void> _readPhone() async {
    final prefs = ref.read(learnPrefsProvider);
    final kept = _chose ? null : await prefs.chapterMinutes();
    final seen = await prefs.coachSeen(_coachId);
    if (!mounted) return;
    setState(() {
      if (!_chose && ChapterModel.validMinutes(kept)) _minutes = kept!;
      if (!seen) _coach = _Coach.shown;
      _phoneRead = true;
    });
    _want(immediate: true);
    if (!seen) await prefs.markCoachSeen(_coachId);
  }

  static const String _coachId = 'piles';

  ChapterPreviewNotifier get _preview => ref.read(chapterPreviewProvider(widget.chapterKey).notifier);

  void _want({bool immediate = false}) => _preview.want(minutes: _minutes, leaveOut: _leaveOut, addNext: _addNext, immediate: immediate);

  void _choose(int m) {
    if (m == _minutes) return;
    setState(() {
      _minutes = m;
      _chose = true;
      _addNext = false;
    });
    ref.read(learnChapterMinutesProvider.notifier).set(m);
    _want();
  }

  Future<void> _openOwn() async {
    final m = await showOwnLengthSheet(context, minutes: _minutes);
    if (m != null && mounted) _choose(m);
  }

  GlobalKey<MmShakeState> _shakeKeyOf(String id) => _shakeKeys.putIfAbsent(id, GlobalKey<MmShakeState>.new);

  void _tapPile(ChapterPile pile, List<ChapterPile> piles) {
    if (_coach == _Coach.shown) setState(() => _coach = _Coach.done);
    switch (ChapterModel.tapOn(pile, piles)) {
      case PileTap.none:
        return;
      case PileTap.putBack:
        setState(() => _leaveOut = [for (final id in _leaveOut) if (id != pile.id) id]);
        _want();
      case PileTap.leaveOut:
        setState(() => _leaveOut = [..._leaveOut, pile.id]);
        _want();
      case PileTap.refused:
        _shakeKeyOf(pile.id).currentState?.shake();
        setState(() => _lastIn = true);
        _lastTimer?.cancel();
        _lastTimer = Timer(const Duration(milliseconds: 2400), () {
          if (mounted) setState(() => _lastIn = false);
        });
    }
  }

  /// Goes to [location] and, when the student comes back, lines the chapter up again (a run changes what is open).
  Future<void> _open(String location) async {
    await context.push<void>(location);
    if (mounted) _preview.retry();
  }

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Learn2Links.home(subject: _subject));
    }
  }

  void _start(LearnPreview? data, ChapterRead read) {
    // While a new answer is on its way the key keeps the last real length and does nothing: it never starts what it does not say.
    if (read.status == ChapterReadStatus.refreshing || data == null) return;
    final resume = ChapterModel.openRun(data);
    unawaited(
      _open(
        Learn2Links.run(
          RunLaunch(
            chapterKey: widget.chapterKey,
            minutes: _minutes,
            leaveOut: _leaveOut,
            addNext: _addNext && data.added != null,
            fresh: resume != null,
          ),
        ),
      ),
    );
  }

  void _resume(LearnOpenRun resume) => unawaited(
    _open(
      resume.kind == LearnKinds.feed
          ? Learn2Links.feed(FeedLaunch(chapterKey: widget.chapterKey, minutes: _minutes, runId: resume.runId))
          : Learn2Links.run(RunLaunch(chapterKey: widget.chapterKey, minutes: _minutes, kind: resume.kind ?? LearnKinds.mix, runId: resume.runId)),
    ),
  );

  void _openShelf(ShelfRowModel row, LearnPreview? data) {
    final key = widget.chapterKey;
    final location = switch (row.id) {
      'cards' => Learn2Links.cards(key),
      'questions' => Learn2Links.run(RunLaunch(chapterKey: key, minutes: _minutes, leaveOut: ChapterModel.onlyPile(LearnPiles.questions))),
      'mistakes' => Learn2Links.run(RunLaunch(chapterKey: key, minutes: _minutes, leaveOut: ChapterModel.onlyPile(LearnPiles.mistakes))),
      'lesson' => data?.shelf.lesson == null ? null : AppRoutes.learnUnit(data!.shelf.lesson!.id),
      // The watermarked sheet is not built in the app yet: it opens the chapter's Must-know cards.
      'print' => Learn2Links.cards(key, filter: 'must'),
      _ => null,
    };
    if (location != null) unawaited(_open(location));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final read = ref.watch(chapterPreviewProvider(widget.chapterKey));
    final data = read.data;
    // The run's length without the next chapter is remembered from the last answer that did not have it.
    if (data != null && read.status == ChapterReadStatus.ready && read.asked?.addNext == false) _baseMinutes = data.realMinutes;

    final missing = read.status == ChapterReadStatus.error && ChapterModel.isChapterMissing(read.error);
    final loading = !_phoneRead || (data == null && read.status != ChapterReadStatus.error);
    final String kind = missing ? 'missing' : (loading ? 'loading' : 'content');
    final body = switch (kind) {
      'missing' => _Missing(subject: _subject, onBack: _back),
      'loading' => _Skeleton(onBack: _back),
      _ => _content(context, read),
    };

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(left: 0, right: 0, top: 0, height: 320, child: IgnorePointer(child: LightField.lamp(context, strength: 0.45))),
          SafeArea(
            bottom: false,
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: MmOverlapSwitcher.fade(
                  alignment: Alignment.topCenter,
                  fit: StackFit.passthrough,
                  child: KeyedSubtree(key: ValueKey(kind), child: body),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _content(BuildContext context, ChapterRead read) {
    final colors = context.mmColors;
    final data = read.data;
    final chapter = data?.chapter;
    final status = read.status;
    final refreshing = status == ChapterReadStatus.refreshing;
    final piles = ChapterModel.pilesFor(data, _leaveOut);
    final resume = ChapterModel.openRun(data);
    final ready = data != null && piles.any((p) => !p.left);
    final shrink = data?.shrink;
    final next = data != null && data.added == null ? shrink?.addNext : null;
    final added = data?.added;
    final plus = added == null ? 0 : ChapterModel.addedMinutes(realMinutes: data?.realMinutes, baseMinutes: _baseMinutes);
    final quiet = _lastIn ? ChapterCopy.lastPileIn : ChapterModel.quietLine(data);
    final freeLimit = data != null && quiet != null && (quiet == data.capped?.text || (data.freeSession?.used == true && quiet == data.free?.text));
    final startLabel = ChapterModel.startLabel(data, _minutes, resume: resume != null);
    final bottom = MediaQuery.paddingOf(context).bottom;
    final failed = status == ChapterReadStatus.error;
    final pileCount = piles.length + (next != null || added != null ? 1 : 0);
    // The Print sheet does not promise a name until the app builds the watermarked sheet.
    final shelf = data == null ? null : ChapterModel.shelfView(data, mistakeMinutes: (n) => ChapterModel.minutesFor(n * 60), namedSheet: false);

    final cells = <Widget>[
      for (final p in piles)
        PileCell(
          key: ValueKey('pile-${p.id}'),
          pile: p,
          view: ChapterModel.pileView(p),
          busy: refreshing,
          refuses: ChapterModel.tapOn(p, piles) == PileTap.refused,
          shakeKey: _shakeKeyOf(p.id),
          describedBy: p.held ? quiet : null,
          onTap: () => _tapPile(p, piles),
        ),
      if (next != null || added != null)
        NextPileCell(
          key: const ValueKey('pile-next'),
          ref: added?.ref ?? next?.ref,
          title: added?.title ?? next?.title ?? '',
          added: added != null,
          plus: plus,
          minutes: _minutes,
          busy: refreshing,
          onTap: () {
            setState(() => _addNext = !_addNext);
            _want();
          },
        ),
    ];

    final strip = _StartStrip(
      label: startLabel,
      line: quiet,
      volt: resume == null,
      enabled: ready,
      busy: refreshing,
      seePro: freeLimit,
      onStart: () => _start(data, read),
    );

    final resumeRow = resume == null ? null : _ResumeRow(resume: resume, onTap: () => _resume(resume));
    final head = chapter == null ? null : ChapterModel.headLines(chapter);

    return SingleChildScrollView(
      padding: EdgeInsets.only(bottom: MmSpace.s32 + bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _BackRow(onBack: _back),
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: _Head(subject: _subject, chapter: chapter, eyebrow: head?.eyebrow, refLine: head?.ref),
          ),
          const SizedBox(height: MmSpace.s20),
          if (resumeRow != null) ...[Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: resumeRow), const SizedBox(height: MmSpace.s20)],
          Column(
            key: _block,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                child: Semantics(
                  header: true,
                  child: Text(ChapterCopy.lengthHead, style: context.mmType.title.copyWith(fontSize: 17, height: 1.25, letterSpacing: -0.2)),
                ),
              ),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                child: LengthControl(minutes: _minutes, onChange: _choose, onOwn: () => unawaited(_openOwn())),
              ),
              if (failed && data == null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
                  child: _ReadFailed(error: read.error, onRetry: _preview.retry),
                )
              else ...[
                const SizedBox(height: 26),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                  child: Semantics(container: true, label: ChapterCopy.listLabel, child: PileGrid(cells: cells)),
                ),
                if (_coach != _Coach.hidden && pileCount > 1)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
                    child: AnimatedOpacity(
                      opacity: _coach == _Coach.done ? 0 : 1,
                      duration: Motion.of(context, const Duration(milliseconds: 200)),
                      child: ExcludeSemantics(
                        excluding: _coach == _Coach.done,
                        child: Text(ChapterCopy.coach, style: context.mmType.caption.copyWith(fontSize: 13.5, height: 1.4, color: colors.ink2, fontWeight: FontWeight.w500)),
                      ),
                    ),
                  ),
                if (status == ChapterReadStatus.stale)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, 0),
                    child: Semantics(liveRegion: true, child: Text(ChapterCopy.stale, style: context.mmType.small.copyWith(color: colors.ink2))),
                  ),
                const SizedBox(height: MmSpace.s16),
                // The Start strip rides at the edge of the screen while this block is on screen; beside a run to pick up it
                // stays where it lies.
                if (resume == null) StickyBottom(container: _block, bottomInset: bottom, child: strip) else strip,
                if (data?.recap != null && data!.recap!.count > 0 && data.recap!.label != null)
                  _Recap(
                    label: data.recap!.label!,
                    onTap: () => unawaited(_open(Learn2Links.run(RunLaunch(chapterKey: widget.chapterKey, minutes: data.recap!.minutes, kind: LearnKinds.recap)))),
                  ),
              ],
            ],
          ),
          const SizedBox(height: MmSpace.group),
          if (shelf != null)
            ChapterShelf(rows: shelf.rows, missing: shelf.missing, onOpen: (row) => _openShelf(row, data))
          else if (failed)
            // The dry run failed: the counts are unknown, but the chapter's cards still open.
            ChapterShelf(
              rows: const [ShelfRowModel(id: 'cards', title: 'Key cards', line: ChapterCopy.shelfCardsFallback)],
              onOpen: (row) => _openShelf(row, null),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------- pieces

/// The back key: a chevron and where it goes. A 48 dp target.
class _BackRow extends StatelessWidget {
  const _BackRow({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(left: MmSpace.s8),
        child: MmPressable(
          onTap: onBack,
          pressedScale: 0.97,
          lift: false,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          semanticsLabel: ChapterCopy.backLabel,
          builder: (context, pressed, focused) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.chevronLeft, size: 18, color: pressed ? colors.ink3 : colors.ink2),
                  const SizedBox(width: MmSpace.s6),
                  Text(ChapterCopy.back, style: type.labelLarge.copyWith(fontSize: 14, color: pressed ? colors.ink3 : colors.ink2)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The head: the unit (only when it adds something), the title, the ref line with the chapter's state, and the subject's
/// object, once.
class _Head extends StatelessWidget {
  const _Head({required this.subject, required this.chapter, required this.eyebrow, required this.refLine});

  final String subject;
  final LearnChapterHead? chapter;
  final String? eyebrow;
  final String? refLine;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final narrow = MediaQuery.sizeOf(context).width < 375;
    final shape = ChapterModel.stateShape(chapter?.state.key);
    final stateColor = switch (shape) {
      'weak' => colors.warnText,
      'strong' => colors.goodText,
      'none' || 'thin' => colors.ink3,
      _ => colors.ink2,
    };
    final label = chapter?.state.label ?? '';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (eyebrow != null) ...[
                Text(eyebrow!, style: type.label.copyWith(color: colors.ink3)),
                const SizedBox(height: MmSpace.s6),
              ],
              Semantics(
                header: true,
                child: Text(
                  chapter?.title ?? ChapterCopy.missingTitle,
                  style: type.screenTitle.copyWith(fontSize: narrow ? 25 : 26, height: 1.12, letterSpacing: -0.3),
                ),
              ),
              if (chapter != null) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 14,
                  runSpacing: MmSpace.s6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (refLine != null) Text(refLine!, style: type.small.copyWith(fontWeight: FontWeight.w500, height: 1.4, color: colors.ink2)),
                    if (label.isNotEmpty)
                      KcStateLine(
                        state: KcChapterState(state: shape, label: label),
                        style: type.label.copyWith(fontSize: 14, height: 1.3, color: stateColor),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 10),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: ExcludeSemantics(child: SubjectEmblem(subject: subject, size: EmblemSizes.tile, framed: false)),
        ),
      ],
    );
  }
}

/// Today's unfinished run of this chapter comes first.
class _ResumeRow extends StatelessWidget {
  const _ResumeRow({required this.resume, required this.onTap});

  final LearnOpenRun resume;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.only(bottom: MmSpace.s20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              header: true,
              child: Text(ChapterCopy.resumeHead(resume.done, resume.of), style: type.labelLarge.copyWith(height: 1.4, color: colors.ink)),
            ),
            if (resume.minutesLeft > 0) ...[
              const SizedBox(height: 2),
              Text(ChapterCopy.resumeLeft(resume.minutesLeft), style: type.caption.copyWith(fontSize: 13.5, height: 1.45, color: colors.ink2)),
            ],
            const SizedBox(height: MmSpace.s12),
            KeyButton(label: ChapterCopy.resumeKey, minHeight: 52, semanticsLabel: ChapterCopy.resumeLabel(resume.done, resume.of), onPressed: onTap),
          ],
        ),
      ),
    );
  }
}

/// The Start key and the one quiet line under it. The key is volt (or a line key beside a run to pick up), names the real
/// length, and does nothing while a new answer is on its way. Under Free's two limit lines a quiet "See Pro".
class _StartStrip extends ConsumerWidget {
  const _StartStrip({required this.label, required this.line, required this.volt, required this.enabled, required this.busy, required this.seePro, required this.onStart});

  final String label;
  final String? line;
  final bool volt;
  final bool enabled;
  final bool busy;
  final bool seePro;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final canUpgrade = seePro && ref.watch(proNudgesOnProvider);
    final press = enabled ? onStart : null;
    final key = volt ? KeyButton(label: label, minHeight: 52, onPressed: press) : KeyButton.secondary(label: label, minHeight: 52, onPressed: press);
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AnimatedOpacity(opacity: busy ? 0.72 : 1, duration: Motion.of(context, const Duration(milliseconds: 150)), child: key),
            // The line keeps its place under the key and is read out when it changes; with nothing to say it takes no room.
            Semantics(
              liveRegion: true,
              container: true,
              child: MmSizeEase(
                duration: const Duration(milliseconds: 180),
                alignment: Alignment.topLeft,
                clipBehavior: Clip.none,
                child: line == null
                    ? const SizedBox(width: double.infinity)
                    : Padding(
                        padding: const EdgeInsets.only(top: MmSpace.s8),
                        child: Text(line!, style: type.caption.copyWith(fontSize: 13.5, height: 1.45, color: colors.ink2, fontWeight: FontWeight.w500)),
                      ),
              ),
            ),
            if (canUpgrade) Align(alignment: Alignment.centerLeft, child: KcLinkAction(label: ChapterCopy.seePro, onTap: () => showUpgradeSheetIfOn(context, reason: ProReason.keycards))),
          ],
        ),
      ),
    );
  }
}

/// "Or a quick recap: the 12 Must-know lines, about 2 min": a text key under the Start key.
class _Recap extends StatelessWidget {
  const _Recap({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(6, 4, MmSpace.gutter, 0),
        child: MmPressable(
          onTap: onTap,
          pressedScale: 0.985,
          lift: false,
          focusRadius: BorderRadius.circular(10),
          haptic: MmPressHaptic.selection,
          highlight: true,
          semanticsLabel: label,
          builder: (context, pressed, focused) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: MmTarget.min),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: MmSpace.s8),
              child: Text(
                label,
                style: type.labelLarge.copyWith(fontSize: 14.5, height: 1.35, color: colors.ink2, decoration: TextDecoration.underline, decorationColor: colors.lineStrong),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The dry run failed and there is nothing to show yet: one line and Try again (the phone being offline says so).
class _ReadFailed extends StatelessWidget {
  const _ReadFailed({required this.error, required this.onRetry});

  final Object? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final offline = error is LearnError && (error! as LearnError).offline;
    return InlineBanner(
      message: offline ? ChapterCopy.offline : ChapterCopy.failed,
      tone: offline ? BannerTone.offline : BannerTone.error,
      actionLabel: ChapterCopy.tryAgain,
      actionChevron: false,
      onAction: onRetry,
    );
  }
}

/// The chapter is not in the book list (404).
class _Missing extends StatelessWidget {
  const _Missing({required this.subject, required this.onBack});

  final String subject;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _BackRow(onBack: onBack),
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: Semantics(
              liveRegion: true,
              container: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: Text(ChapterCopy.missingTitle, style: type.screenTitle.copyWith(fontSize: 26, height: 1.12, letterSpacing: -0.3))),
                  const SizedBox(height: 14),
                  Text(ChapterCopy.missing, style: type.small.copyWith(fontWeight: FontWeight.w500, height: 1.5, color: colors.ink2)),
                  const SizedBox(height: 14),
                  KeyButton.secondary(label: ChapterCopy.backToLearn, expanded: false, onPressed: onBack),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Before the first dry run: the page in outline at its real sizes, so nothing on screen moves when the answer lands.
class _Skeleton extends StatelessWidget {
  const _Skeleton({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      child: SkeletonGroup(
        label: ChapterCopy.loading,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _BackRow(onBack: onBack),
            const SizedBox(height: 2),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Skeleton(height: 26, radius: 10),
                  SizedBox(height: 8),
                  Skeleton(height: 26, width: 160, radius: 10),
                  SizedBox(height: 10),
                  Skeleton(height: 20, width: 150, radius: 10),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s20),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Skeleton(height: 22, width: 200, radius: 10),
                  SizedBox(height: 10),
                  Skeleton(height: LengthControl.height, radius: 24),
                  SizedBox(height: 26),
                  PileGridSkeleton(),
                  SizedBox(height: MmSpace.s24),
                  Skeleton(height: 52, radius: 26),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
