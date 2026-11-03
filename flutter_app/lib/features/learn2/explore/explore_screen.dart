// Explore: the chapter feed covers (the web's DiscoveryFeed.jsx with ExploreCovers.jsx, Option A, phone band). Practice's fourth door
// (LK51, 3 Nov; `embedded`: inside the Practice page, under its switch, so no second back header and no page of its own to scroll)
// or, standing alone, a root page over the shell with its back header. Its content is the student's subjects as chips,
// "Chapter feeds" with the feed length (5, 10 or 20 minutes, kept on this phone), a row of one cover per chapter with a pager
// under it, then "Questions" and the way to the untimed questions. Every state is drawn: loading (covers at their real size), Free at 20 minutes, Free with the day used
// (keys open the chapter's questions), a feed to pick up, error with Try again, and no chapters.
//
// A tap on a cover opens its feed (`Learn2Links.feed`) and tells it where it came from (`source: explore_cover`, whether it
// was the For you cover, and its position), or picks up the feed it holds; at Free's day limit it opens that chapter's
// untimed questions instead. Coming back re-reads the covers (a feed started or finished changes them).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show SemanticsService;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/insights_paths.dart';
import '../../insights/widgets/entry_points.dart' show StreamEntry;
import '../../practice/data/practice_catalog.dart';
import '../../practice/data/practice_prefs.dart' show storedSubjectId;
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../../today/logic/subjects.dart' show canonicalSubject;
import '../data/learn_prefs.dart' show learnPrefsProvider;
import '../data/learn_providers.dart';
import '../learn2_links.dart';
import 'cover_card.dart';
import 'cover_model.dart';
import 'covers_row.dart';
import 'explore_copy.dart';

/// `/practice?door=explore[&subject=]` (and `/explore`, which opens it): the chapter feed covers. [subject] is a public subject id a
/// link named; the page then shows it (and makes it the subject Practice and Learn share). [embedded]: the door's content inside
/// Practice's own page, with no header, no scaffold and no scroll of its own.
class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key, this.subject, this.embedded = false});

  final String? subject;
  final bool embedded;

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

enum _Phase { loading, error, empty, ready }

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  /// The subject a link named, shown for the one frame until it is the shared subject (then null: the page follows the shared one).
  String? _linked;

  /// The length kept on this phone has been read: until then the control waits, so it never opens on 10 and slides to the
  /// 20 the student chose last time.
  bool _lengthRead = false;

  /// The covers' first-visit nudge has not been shown on this phone (read once; it plays once, LK29).
  bool _nudge = false;

  @override
  void initState() {
    super.initState();
    unawaited(ref.read(learnPrefsProvider).feedMinutes().whenComplete(() {
      if (mounted) setState(() => _lengthRead = true);
    }));
    unawaited(ref.read(learnPrefsProvider).coversNudgeSeen().then((seen) {
      if (mounted && !seen) setState(() => _nudge = true);
    }));
    _takeLink(widget.subject);
  }

  @override
  void didUpdateWidget(ExploreScreen old) {
    super.didUpdateWidget(old);
    // A new link to this page (the same page kept by the router) hands over its subject the same way.
    if (widget.subject != null && widget.subject != old.subject) _takeLink(widget.subject);
  }

  /// A link's `?subject=` is a one-shot handoff: it shows at once, becomes the subject Practice and Learn share after the frame,
  /// and then the page follows that shared subject again (the Practise door's switch, another link), so a later change is never
  /// held back by the first link.
  void _takeLink(String? subject) {
    final want = subject?.trim();
    if (want == null || !storedSubjectId.hasMatch(want)) return;
    final linked = _linked = canonicalSubject(want);
    // Practice and Learn follow the link's subject; a provider is not changed while the page builds.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (ref.read(practiceSubjectProvider) != linked) ref.read(practiceSubjectProvider.notifier).select(linked);
      if (_linked == linked) setState(() => _linked = null);
    });
  }

  void _pickSubject(String id) {
    setState(() => _linked = null);
    ref.read(practiceSubjectProvider.notifier).select(id);
  }

  void _pickLength(int minutes) {
    ref.read(learnFeedMinutesProvider.notifier).set(minutes);
    unawaited(SemanticsService.sendAnnouncement(View.of(context), ExploreCopy.showing(minutes), Directionality.of(context)));
  }

  /// A tap on a cover: its feed (new, with where it came from, or the one it holds), or at Free's day limit the chapter's
  /// untimed questions.
  Future<void> _open(CoverView view, int index, {required String practiceId, required String subject, required int minutes}) async {
    final c = view.cover;
    final String location;
    if (view.opensQuestions) {
      location = InsightsPaths.streamFor(subject: practiceId, chapter: CoverModel.chapterNameOf(c));
    } else {
      final held = c.resume?.runId;
      location = Learn2Links.feed(
        held != null
            ? FeedLaunch(chapterKey: c.key, minutes: minutes, runId: held)
            : FeedLaunch(chapterKey: c.key, minutes: minutes, source: 'explore_cover', forYou: c.forYou, position: index),
      );
    }
    await context.push<void>(location);
    if (mounted && !view.opensQuestions) ref.invalidate(learnCoversProvider(subject));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final String practiceId = _linked ?? ref.watch(practiceSubjectProvider);
    final subject = canonicalSubject(practiceId);
    final minutes = ref.watch(learnFeedMinutesProvider);
    final read = ref.watch(learnCoversProvider(subject));
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final auth = ref.watch(authSnapshotProvider);
    final canUpgrade = ref.watch(proNudgesOnProvider);

    // The answer, kept on screen while it is read again; a first read and a retry show the skeleton.
    final data = read.value;
    final phase = data != null
        ? (data.covers.isEmpty ? _Phase.empty : _Phase.ready)
        : (read.isLoading || !read.hasError ? _Phase.loading : _Phase.error);
    final ready = phase == _Phase.ready;
    final history = ready ? CoverModel.hasHistory(data!) : true;
    final free = ready && CoverModel.isFreePlan(data!);
    final freeDone = ready && data!.free != null;
    final subjectName = (data?.subject?.name) ?? subjectNameFor(practiceId, catalog);

    final choices = subjectChoices(chosen: auth.subjects, selected: practiceId, catalog: catalog);
    final bottom = MediaQuery.paddingOf(context).bottom + MmSpace.s32;

    // The web's phone band shows a line here only at a real Free limit (covers.css hides the general line and the
    // chapter count under 768 px; the pager under the row already says "1 of 14").
    final String? note;
    if (freeDone) {
      note = ExploreCopy.freeDone;
    } else if (free && minutes == 20) {
      note = ExploreCopy.freeCapped;
    } else {
      note = null;
    }

    final Widget section = switch (phase) {
      _Phase.loading => const ExploreCoversSkeleton(),
      _Phase.error => _Message(text: ExploreCopy.loadFailed, action: ExploreCopy.tryAgain, onAction: () => ref.invalidate(learnCoversProvider(subject))),
      _Phase.empty => _Message(text: ExploreCopy.none(data!.subject?.name ?? ExploreCopy.thisSubject)),
      _Phase.ready => ExploreCovers(
        label: '$subjectName chapter feeds',
        views: [for (final c in data!.covers) CoverView.of(c, minutes: minutes, history: history, free: free, freeDone: freeDone)],
        onOpen: (view, index) => unawaited(_open(view, index, practiceId: practiceId, subject: subject, minutes: minutes)),
        nudge: _nudge,
        onNudged: () => unawaited(ref.read(learnPrefsProvider).markCoversNudgeSeen()),
      ),
    };

    final content = <Widget>[
      if (choices.length > 1) ...[
        ChipRail(
          semanticLabel: ExploreCopy.subjectLabel,
          revealIndex: choices.indexWhere((s) => s.id == practiceId),
          children: [
            for (final s in choices) MmChip(label: s.name, selected: s.id == practiceId, showBubble: false, onTap: () => _pickSubject(s.id)),
          ],
        ),
        const SizedBox(height: MmSpace.s16),
      ],
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: _FeedsHead(count: null, minutes: minutes, onMinutes: _pickLength, lengthRead: _lengthRead),
      ),
      if (ready && note != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
          child: _Note(text: note, seePro: freeDone && canUpgrade),
        ),
      const SizedBox(height: MmSpace.s12),
      MmOverlapSwitcher(
        alignment: Alignment.topCenter,
        fit: StackFit.passthrough,
        child: KeyedSubtree(key: ValueKey('$subject-${phase.name}'), child: section),
      ),
      const SizedBox(height: MmRhythm.section),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: Divider(height: 1, thickness: 1, color: colors.line),
      ),
      const SizedBox(height: MmSpace.s16),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: Semantics(header: true, child: Text(ExploreCopy.questionsHeading, style: _heading(context))),
      ),
                          const SizedBox(height: MmSpace.s4),
                          Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: StreamEntry(subject: practiceId)),
    ];

    // The Practice door: the content in Practice's own list, under its switch (no header, no second scroll).
    if (widget.embedded) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: content);
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(left: 0, right: 0, top: 0, height: 360, child: IgnorePointer(child: LightField.lamp(context, strength: 0.55))),
          SafeArea(
            bottom: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const MmPageHeader(title: ExploreCopy.title, fallbackRoute: AppRoutes.practice),
                    Expanded(
                      child: ListView(
                        padding: EdgeInsets.fromLTRB(0, MmSpace.s8, 0, bottom),
                        children: content,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A section heading of the page (the web's 20 dp display heading): "Chapter feeds", "Questions".
TextStyle _heading(BuildContext context) => context.mmType.title.copyWith(fontSize: 20, height: 24 / 20, letterSpacing: -0.3);

/// "Chapter feeds" with its count under it, and the length control: on one row where they fit (the web's row), else the
/// control under the heading at the row's width with its words spelled out.
class _FeedsHead extends StatelessWidget {
  const _FeedsHead({required this.count, required this.minutes, required this.onMinutes, required this.lengthRead});

  /// The number of covers, once they are in.
  final int? count;
  final int minutes;
  final ValueChanged<int> onMinutes;

  /// False until the length kept on this phone is known: the control's place is kept, its words are not drawn yet.
  final bool lengthRead;

  /// The row is wide enough to spell "5 min" and "10 min" out from here (the web's 420 dp row).
  static const double wideRow = 420;

  /// The air inside a segment, each side of its words.
  static const double segmentAir = 6;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    final title = _heading(context);
    final countStyle = type.caption.copyWith(color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]);
    final label = type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w700);

    double width(String text, TextStyle style) {
      final painter = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
      final w = painter.width;
      painter.dispose();
      return w;
    }

    Widget control(List<String> labels, {double? at}) {
      final segments = <MmSegment<int>>[
        for (var i = 0; i < CoverModel.lengths.length; i++) MmSegment<int>(CoverModel.lengths[i], labels[i]),
      ];
      final bar = lengthRead
          ? MmSegmented<int>(segments: segments, value: minutes, onChanged: onMinutes, semanticsLabel: ExploreCopy.lengthLabel, showBubbles: false)
          : const SizedBox(height: MmSegmented.height);
      return at == null ? bar : SizedBox(width: at, child: bar);
    }

    return LayoutBuilder(
      builder: (context, box) {
        final unit = box.maxWidth >= wideRow;
        final short = [for (final m in CoverModel.lengths) ExploreCopy.length(m, unit: unit || m == CoverModel.lengths.last)];
        final long = [for (final m in CoverModel.lengths) ExploreCopy.length(m, unit: true)];
        final segment = [for (final s in short) width(s, label)].reduce((a, b) => a > b ? a : b) + 2 * segmentAir;
        final controlWidth = 3 * segment + 8;
        final heading = width(ExploreCopy.feedsHeading, title);
        final counted = count == null ? 0.0 : width(CoverModel.chaptersText(count!), countStyle);
        final fits = (heading > counted ? heading : counted) + MmSpace.s12 + controlWidth <= box.maxWidth;

        final headline = Semantics(header: true, child: Text(ExploreCopy.feedsHeading, style: title));
        if (fits) {
          return ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [headline, if (count != null) Text(CoverModel.chaptersText(count!), style: countStyle)],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                control(short, at: controlWidth),
              ],
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Flexible(child: headline),
                if (count != null) ...[const SizedBox(width: MmSpace.s12), Text(CoverModel.chaptersText(count!), style: countStyle)],
              ],
            ),
            const SizedBox(height: MmSpace.s12),
            control(long),
            const SizedBox(height: 2),
          ],
        );
      },
    );
  }
}

/// The line under the head: what a feed is, Free's cap at 20 minutes, or Free's day used with its way to Pro.
class _Note extends StatelessWidget {
  const _Note({required this.text, required this.seePro});

  final String text;
  final bool seePro;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MmOverlapSwitcher.fade(
          alignment: Alignment.topLeft,
          child: KeyedSubtree(
            key: ValueKey<String>(text),
            child: Text(text, style: context.mmType.small.copyWith(fontWeight: FontWeight.w500, height: 1.45, color: colors.ink2)),
          ),
        ),
        // The key's 48 dp target reaches 8 dp past its face: that air is inside this box, so all of it answers a finger.
        if (seePro) Padding(padding: const EdgeInsets.only(bottom: 8), child: _TextKey(label: ExploreCopy.seePro, onTap: () => showUpgradeSheetIfOn(context, reason: ProReason.keycards))),
      ],
    );
  }
}

/// A line in place of the covers, between two hairlines (an error with its way to try again, or no chapters).
class _Message extends StatelessWidget {
  const _Message({required this.text, this.action, this.onAction});

  final String text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
      child: DecoratedBox(
        decoration: BoxDecoration(border: Border.symmetric(horizontal: BorderSide(color: colors.line))),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Semantics(
                liveRegion: true,
                container: true,
                child: Wrap(
                  spacing: MmSpace.s12,
                  runSpacing: MmSpace.s4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(text, style: context.mmType.small.copyWith(fontWeight: FontWeight.w500, height: 1.45, color: colors.ink2)),
                    if (action != null) _TextKey(label: action!, onTap: onAction),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A text key with a volt underline (the web's `.fxc-textkey`): 14 semibold ink, a 48 dp target around a 32 dp face.
class _TextKey extends StatelessWidget {
  const _TextKey({required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmHitSlop.toTarget(
      visual: 32,
      child: MmPressable(
        onTap: onTap,
        haptic: MmPressHaptic.selection,
        pressedScale: 0.97,
        focusRadius: BorderRadius.circular(6),
        semanticsLabel: label,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 32),
          child: Align(
            widthFactor: 1,
            alignment: Alignment.centerLeft,
            child: DecoratedBox(
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.accentText, width: 2))),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(
                  label,
                  // A whole 18 dp line, so the volt underline under it falls on whole pixels.
                  style: context.mmType.labelLarge.copyWith(fontSize: 14, height: 18 / 14, color: colors.ink.withValues(alpha: pressed ? 0.75 : 1)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
