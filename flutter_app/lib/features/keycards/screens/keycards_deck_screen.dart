import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api/api_error.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/copy/formatters.dart' show formatTime12;
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/keycards_models.dart';
import '../data/keycards_providers.dart';
import '../data/keycards_rules.dart';
import '../keycards_copy.dart';
import '../widgets/key_card_parts.dart';
import '../widgets/key_card_run.dart';

/// The three ways through a chapter's deck.
enum KcMode {
  read('read'),
  study('study'),
  lastLook('last-look');

  const KcMode(this.param);

  final String param;

  static KcMode parse(String? v) => KcMode.values.where((m) => m.param == v).firstOrNull ?? KcMode.read;
}

/// Opens the system share sheet with [text]. Swapped in tests.
final keyCardsShareProvider = Provider<Future<bool> Function(String text, String subject)>(
  (ref) => (text, subject) async {
    try {
      await SharePlus.instance.share(ShareParams(text: text, subject: subject));
      return true;
    } on Object {
      return false;
    }
  },
);

/// `/cards/:chapter`, a chapter's deck (KEYCARDS-BUILD-SPEC 3 and 4).
///
///   Header   the unit, the chapter title, the NCERT reference (and the chip)
///   Actions  Add chapter to Revise (its Must-know set); Pro: Share chapter sheet
///   Modes    Read (book order, the book's own words with the reference; Free's locked cards as one quiet
///            row), Study (a card session), Last look (Must-know only, swipe or Next, nothing scheduled)
class KeyCardsDeckScreen extends ConsumerStatefulWidget {
  const KeyCardsDeckScreen({super.key, required this.chapterKey, this.initialMode = KcMode.read});

  final String chapterKey;
  final KcMode initialMode;

  @override
  ConsumerState<KeyCardsDeckScreen> createState() => _KeyCardsDeckScreenState();
}

class _KeyCardsDeckScreenState extends ConsumerState<KeyCardsDeckScreen> with SingleTickerProviderStateMixin {
  late KcMode _mode = widget.initialMode;

  /// The chosen mode fades in (Read's rows, or the session) when the mode changes.
  late final AnimationController _modeFade;
  late final Animation<double> _modeOpacity;
  bool _adding = false;
  String? _addLine;
  bool _addFailed = false;
  final Set<String> _addedNow = {};

  /// Bumped to start a fresh Study or Last look when the mode is chosen again.
  int _session = 0;

  Future<void> _add(KcDeck deck) async {
    if (_adding) return;
    setState(() {
      _adding = true;
      _addLine = null;
      _addFailed = false;
    });
    try {
      final result = await ref.read(keyCardsApiProvider).add(chapter: deck.chapter.key);
      if (!mounted) return;
      setState(() {
        _adding = false;
        _addLine = KeyCardsCopy.added(result.added);
        _addedNow.addAll(deck.mustKnowCards.map((c) => c.id));
      });
      ref
        ..invalidate(keyCardsHomeProvider)
        ..invalidate(keyCardsDueProvider);
    } on Object {
      if (!mounted) return;
      setState(() {
        _adding = false;
        _addFailed = true;
        _addLine = KeyCardsCopy.addFailed;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _modeFade = AnimationController(vsync: this, value: 1);
    _modeOpacity = CurvedAnimation(parent: _modeFade, curve: Motion.out);
  }

  @override
  void dispose() {
    _modeFade.dispose();
    super.dispose();
  }

  void _choose(KcMode mode) {
    setState(() {
      _mode = mode;
      _session += 1;
    });
    _modeFade.duration = Motion.of(context, Motion.ui);
    unawaited(_modeFade.forward(from: 0));
  }

  Future<void> _share(KcDeck deck) async {
    final lines = <String>[deck.chapter.title, if (deck.chapter.ncertLine != null) deck.chapter.ncertLine!, ''];
    for (final c in deck.mustKnowCards) {
      lines
        ..add(c.front)
        ..add(c.back)
        ..add(c.source.reference ?? '')
        ..add('');
    }
    await ref.read(keyCardsShareProvider)(lines.join('\n').trim(), deck.chapter.title);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final read = ref.watch(keyCardsDeckProvider(widget.chapterKey));
    final data = read.value;
    final asOf = data?.savedAt == null ? null : KeyCardsCopy.asOf(formatTime12(data!.savedAt!.toLocal()));

    final Widget body;
    final String kind;
    if (data != null) {
      kind = 'content';
      body = _content(data.value.withAdded(_addedNow), cached: data.cached);
    } else if (read.hasError && !read.isLoading) {
      final e = read.error;
      final offline = e is ApiError && e.isOffline;
      kind = 'error';
      body = StateView(
        kind: offline ? StateViewKind.offline : StateViewKind.error,
        title: KeyCardsCopy.loadFailed,
        message: KeyCardsCopy.loadFailedNote,
        primary: StateAction(KeyCardsCopy.tryAgain, () => ref.invalidate(keyCardsDeckProvider(widget.chapterKey))),
      );
    } else {
      kind = 'loading';
      body = const _DeckSkeleton();
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(left: 0, right: 0, top: 0, height: 320, child: IgnorePointer(child: LightField.lamp(context, strength: 0.45))),
          SafeArea(
            bottom: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (data?.cached ?? false) const InlineBanner.offlineStrip(message: KeyCardsCopy.offlineCached),
                    MmPageHeader(title: KeyCardsCopy.title, caption: asOf, fallbackRoute: AppRoutes.keyCards),
                    Expanded(
                      child: MmOverlapSwitcher.fade(
                        alignment: Alignment.topCenter,
                        child: KeyedSubtree(key: ValueKey(kind), child: body),
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

  Widget _content(KcDeck deck, {required bool cached}) {
    final colors = context.mmColors;
    final type = context.mmType;
    final isPro = ref.watch(authSnapshotProvider.select((s) => s.isPro));
    final ch = deck.chapter;
    final cards = deck.cards;
    final subject = cards.firstOrNull?.subject ?? ch.key.split('.').first;
    final reason = isPro ? ref.watch(keyCardsMyChaptersProvider(subject)).value?.chapter(ch.key) : null;
    final bottom = MediaQuery.paddingOf(context).bottom + MmSpace.s32;

    final header = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The CUET unit, when it is more than this one chapter's own name.
        if (ch.unit != null && ch.unit != ch.title) ...[
          Text(ch.unit!, style: type.label.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s4),
        ] else
          const SizedBox(height: MmSpace.s4),
        Semantics(header: true, child: Text(ch.title, style: type.title)),
        if (ch.ncertLine != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(ch.ncertLine!, style: type.small.copyWith(color: colors.ink3)),
        ],
        if (ch.chip != null) ...[
          const SizedBox(height: MmSpace.s8),
          Align(alignment: Alignment.centerLeft, child: KcTag(text: ch.chip!)),
        ],
        if (reason != null) ...[
          const SizedBox(height: MmSpace.s12),
          KcStateLine(state: reason.state, style: type.small.copyWith(color: colors.ink)),
          if (reason.reason != null) ...[
            const SizedBox(height: MmSpace.s2),
            Text(reason.reason!, style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
          ],
        ],
      ],
    );

    if (deck.entries.isEmpty) {
      return ListView(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, bottom),
        children: [
          header,
          const SizedBox(height: MmSpace.s32),
          Text(KeyCardsCopy.emptyChapter, style: type.cardTitle),
          const SizedBox(height: MmSpace.s4),
          Text(KeyCardsCopy.emptyChapterNote, style: type.body.copyWith(color: colors.ink2)),
        ],
      );
    }

    final allAdded = deck.allAdded;
    final actions = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${KeyCardsCopy.cardsOnly(deck.total)}. ${deck.mustKnow} ${KeyCardsCopy.mustKnow}.',
          style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        const SizedBox(height: MmSpace.s12),
        if (allAdded && _addLine == null)
          const ReceiptLine(text: KeyCardsCopy.inRevise)
        else if (_addLine != null && !_addFailed)
          ReceiptLine(text: _addLine!)
        else
          KeyButton.secondary(
            label: KeyCardsCopy.addToRevise,
            loading: _adding,
            onPressed: cached ? null : () => unawaited(_add(deck)),
          ),
        if (_addFailed) ...[
          const SizedBox(height: MmSpace.s4),
          Semantics(liveRegion: true, child: Text(_addLine!, style: type.small.copyWith(color: colors.warnText))),
        ],
        if (isPro && deck.mustKnowCards.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s4),
          KcLinkAction(label: KeyCardsCopy.shareSheet, onTap: () => unawaited(_share(deck))),
        ],
      ],
    );

    final top = <Widget>[
      header,
      const SizedBox(height: MmSpace.s16),
      actions,
      const SizedBox(height: MmSpace.s24),
      MmSegmented<KcMode>(
        showBubbles: false,
        semanticsLabel: KeyCardsCopy.modes,
        segments: const [
          MmSegment(KcMode.read, KeyCardsCopy.read),
          MmSegment(KcMode.study, KeyCardsCopy.study),
          MmSegment(KcMode.lastLook, KeyCardsCopy.lastLook),
        ],
        value: _mode,
        onChanged: _choose,
      ),
      const SizedBox(height: MmSpace.s16),
    ];

    // Read builds its rows as they scroll into view: a chapter can hold 165 cards, and building them all at once
    // held the first frame for a fifth of a second on the emulator (the device walk of 31 Oct). One list for
    // every mode, so choosing a mode keeps the page where it is.
    final read = _mode == KcMode.read;
    final rows = read ? _readRows(deck) : const <Widget Function()>[];
    final Widget? session = switch (_mode) {
      KcMode.read => null,
      KcMode.study => KeyCardRun(
        key: ValueKey('kc-study-$_session'),
        cards: cards,
        mode: KeyCardRules.modeStudy,
        onDone: () => _choose(KcMode.read),
      ),
      KcMode.lastLook => KcLastLook(key: ValueKey('kc-last-$_session'), cards: deck.mustKnowCards),
    };

    return LayoutBuilder(
      builder: (context, constraints) => ListView.builder(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, bottom),
        itemCount: top.length + (read ? rows.length : 1),
        itemBuilder: (context, i) {
          if (i < top.length) return top[i];
          final j = i - top.length;
          if (session == null) {
            return FadeTransition(
              opacity: _modeOpacity,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [if (j > 0) Divider(height: 1, thickness: 1, color: colors.line), rows[j]()],
              ),
            );
          }
          // A card session holds at least a screen of room below its card, so once the page has moved the card
          // up to show its keys, a shorter next card does not pull the page back down to the chapter's header.
          return ConstrainedBox(
            constraints: BoxConstraints(minHeight: (constraints.maxHeight - bottom).clamp(0, double.infinity)),
            child: Align(
              alignment: Alignment.topCenter,
              child: FadeTransition(opacity: _modeOpacity, child: session),
            ),
          );
        },
      ),
    );
  }
}

/// Read's rows: every card in book order (the list draws hairlines between them), with Free's locked cards
/// folded into one quiet row where the first of them stands.
List<Widget Function()> _readRows(KcDeck deck) {
  final rows = <Widget Function()>[];
  var lockedShown = false;
  for (final e in deck.entries) {
    if (e.locked) {
      if (lockedShown) continue;
      lockedShown = true;
      final count = deck.locked > 0 ? deck.locked : deck.entries.where((x) => x.locked).length;
      rows.add(() => KcLockedRow(count: count));
      continue;
    }
    final card = e.card!;
    rows.add(() => KcReadCard(key: ValueKey('kc-read-${card.id}'), card: card));
  }
  return rows;
}

class _DeckSkeleton extends StatelessWidget {
  const _DeckSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: KeyCardsCopy.deckLoading,
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(width: 120, height: 14),
            SizedBox(height: MmSpace.s8),
            Skeleton(width: 240, height: 24),
            SizedBox(height: MmSpace.s24),
            Skeleton(height: 56, radius: 28),
            SizedBox(height: MmSpace.s24),
            Skeleton(height: 44, radius: 22),
            SizedBox(height: MmSpace.s16),
            MmSkeletonRows(rows: 3),
          ],
        ),
      ),
    );
  }
}

/// Opens [chapterKey]'s deck, from any screen.
void openKeyCardsChapter(BuildContext context, String chapterKey) => unawaited(context.push<void>(AppRoutes.keyCardsChapter(chapterKey)));
