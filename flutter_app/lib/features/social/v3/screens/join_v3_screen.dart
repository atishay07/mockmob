// J1 Join with a code (spec 5.3).
//
// "Join a Mob". Six boxes shown "K7P 2M9" (they grow to eight for an old code, and take a paste of the
// code or the whole link). When the server knows the code: a preview with NO names (the silhouettes of
// the members' Folds, "Chai Circle, Accountancy", "3 of 5 seats taken"), "Pick who you'll be", your
// first name, the privacy line and the key "Join Chai Circle". A code that does not work says why:
// invalid, expired, full or paused, each in a plain sentence with one way forward.

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_state.dart';
import '../../../../core/auth/display_name.dart' show shownName;
import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../you/widgets/you_page.dart';
import '../../data/mob_models.dart' show isValidMobName, mobNameFrom;
import '../../data/mob_repository.dart' show mobRepositoryProvider;
import '../../copy.dart';
import '../../widgets/mob_parts.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/mob_say.dart';
import '../widgets/code_boxes.dart';
import '../widgets/fold_picker.dart';
import '../widgets/fold_puppet.dart';
import '../widgets/mob_fx.dart';

enum _Phase { empty, checking, valid, notValid, failed }

class JoinV3Screen extends ConsumerStatefulWidget {
  const JoinV3Screen({super.key, this.code = ''});

  /// A code or a whole link, from a deep link or from the code sheet.
  final String code;

  @override
  ConsumerState<JoinV3Screen> createState() => _JoinV3ScreenState();
}

class _JoinV3ScreenState extends ConsumerState<JoinV3Screen> {
  final TextEditingController _code = TextEditingController();
  final FocusNode _focus = FocusNode();
  late final TextEditingController _name;
  Timer? _debounce;
  int _seq = 0;
  int _lastLen = 0;

  _Phase _phase = _Phase.empty;
  JoinPreview? _preview;
  String? _sentence;
  FoldKey? _fold;
  int _colour = 3;
  String? _nameError;
  String? _joinError;
  bool _joining = false;

  @override
  void initState() {
    super.initState();
    final auth = ref.read(authSnapshotProvider);
    final first = mobNameFrom(shownName(auth.name, email: auth.email));
    _name = TextEditingController(text: first);
    _colour = first.isEmpty ? 3 : (first.codeUnits.fold<int>(0, (a, b) => a + b) + 3) % MobColours.count;
    final given = joinCodeFromInput(widget.code);
    if (given.isNotEmpty) {
      _code.text = given;
      _lastLen = given.length;
      if (given.length == 6 || given.length == 8) {
        _phase = _Phase.checking;
        WidgetsBinding.instance.addPostFrameCallback((_) => _lookup(given));
      }
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _code.dispose();
    _focus.dispose();
    _name.dispose();
    super.dispose();
  }

  void _onCode(String code) {
    _debounce?.cancel();
    _seq++;
    final pasted = (code.length - _lastLen).abs() > 1;
    _lastLen = code.length;
    final complete = code.length == 6 || code.length == 8;
    setState(() {
      _joinError = null;
      _preview = null;
      _sentence = null;
      _phase = complete ? _Phase.checking : _Phase.empty;
    });
    if (!complete) return;
    // A pasted code is asked at once. Typing waits a moment, so the sixth character of an old
    // 8-character code is not judged before the seventh arrives.
    if (pasted) {
      _lookup(code);
    } else {
      _debounce = Timer(const Duration(milliseconds: 450), () => _lookup(code));
    }
  }

  Future<void> _lookup(String code) async {
    final mine = ++_seq;
    try {
      final p = await ref.read(mobV3ApiProvider).joinPreview(code);
      if (!mounted || mine != _seq) return;
      setState(() {
        _preview = p;
        if (p.valid) {
          _phase = _Phase.valid;
          _fold ??= ref.read(mobRepositoryProvider).value?.v3?.seat ?? FoldKey.dart;
        } else {
          _phase = _Phase.notValid;
          _sentence = switch (p.status) {
            'expired' => MobV3Copy.errors['INVITE_EXPIRED'],
            'full' => MobV3Copy.errors['MOB_FULL'],
            'paused' => MobV3Copy.joinPaused,
            _ => MobV3Copy.errors['INVITE_INVALID'],
          };
        }
      });
    } on Object catch (e) {
      if (!mounted || mine != _seq) return;
      setState(() {
        final code = mobErrorCode(e);
        // A code the server does not know, or one that has run out, is a state of the code. Anything else
        // (offline, a server fault) is a state of the call, and the student can try again.
        final ofCode = code == 'INVITE_INVALID' || code == 'INVITE_EXPIRED' || code == 'MOB_FULL' || code == 'JOIN_PAUSED' || code == 'NOT_FOUND';
        _phase = ofCode ? _Phase.notValid : _Phase.failed;
        _sentence = code == 'NOT_FOUND' ? MobV3Copy.errors['INVITE_INVALID'] : mobV3Say(e);
      });
    }
  }

  Future<void> _join() async {
    final p = _preview;
    final fold = _fold;
    if (_joining || p == null || !p.valid || fold == null) return;
    if (!isValidMobName(_name.text)) {
      setState(() => _nameError = MobCopy.nameRule);
      return;
    }
    setState(() {
      _joining = true;
      _joinError = null;
      _nameError = null;
    });
    try {
      await ref.read(mobV3ActionsProvider).join(code: _code.text, name: _name.text.trim(), colour: _colour, fold: fold);
      ref.read(hapticsProvider).confirm();
      if (!mounted) return;
      setState(() => _joining = false);
      await Navigator.of(context).maybePop();
    } on Object catch (e) {
      if (!mounted) return;
      final code = mobErrorCode(e);
      setState(() {
        _joining = false;
        if (mobErrorIsName(e)) {
          _nameError = mobV3Say(e);
        } else if (code == 'INVITE_INVALID' || code == 'INVITE_EXPIRED' || code == 'MOB_FULL' || code == 'JOIN_PAUSED') {
          // The code stopped working, or the Mob filled, since the preview: the page now says so.
          _phase = _Phase.notValid;
          _sentence = mobV3Say(e);
        } else {
          _joinError = mobV3Say(e);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final p = _preview;
    final valid = _phase == _Phase.valid && p != null;
    final owned = ownedFoldsOf(ref.watch(shelfProvider));
    final boxState = switch (_phase) {
      _Phase.checking => CodeBoxState.checking,
      _Phase.valid => CodeBoxState.ok,
      _Phase.notValid => CodeBoxState.bad,
      _ => CodeBoxState.idle,
    };
    return MobIdleScope(
      child: YouPage(
        title: MobV3Copy.joinTitle,
        footer: valid
            ? KeyButton(key: const ValueKey('j1-join'), label: MobV3Copy.joinKey(p.name), loading: _joining, onPressed: _joining ? null : _join)
            : null,
        children: [
          Padding(
            padding: youGutter,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(MobV3Copy.joinLine, style: type.body.copyWith(color: c.ink2)),
                const SizedBox(height: MmSpace.s16),
                CodeBoxes(controller: _code, focusNode: _focus, state: boxState, autofocus: widget.code.isEmpty, onChanged: _onCode),
                const SizedBox(height: MmSpace.s16),
                AnimatedSize(
                  duration: Motion.reduced(context) ? Motion.reducedFade : Motion.ui,
                  curve: Motion.out,
                  alignment: Alignment.topCenter,
                  child: switch (_phase) {
                    _Phase.empty => const SizedBox(width: double.infinity),
                    _Phase.checking => const SkeletonGroup(label: MobV3Copy.joinChecking, child: Skeleton(height: 96)),
                    _Phase.valid => _ValidBlock(
                        preview: p!,
                        owned: owned,
                        fold: _fold,
                        onFold: (f) => setState(() => _fold = f),
                        name: _name,
                        nameError: _nameError,
                        onName: () => setState(() => _nameError = null),
                        error: _joinError,
                      ),
                    _Phase.notValid || _Phase.failed => _StateBlock(
                        sentence: _sentence ?? MobV3Copy.generic,
                        failed: _phase == _Phase.failed,
                        onRetry: () {
                          setState(() => _phase = _Phase.checking);
                          _lookup(_code.text);
                        },
                      ),
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The preview (no names), the Fold to be, your name and the privacy line.
class _ValidBlock extends StatelessWidget {
  const _ValidBlock({
    required this.preview,
    required this.owned,
    required this.fold,
    required this.onFold,
    required this.name,
    required this.nameError,
    required this.onName,
    required this.error,
  });

  final JoinPreview preview;
  final List<FoldKey> owned;
  final FoldKey? fold;
  final ValueChanged<FoldKey> onFold;
  final TextEditingController name;
  final String? nameError;
  final VoidCallback onName;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        JoinPreviewCard(preview: preview),
        const SizedBox(height: MmSpace.s24),
        Semantics(header: true, child: Text(MobV3Copy.pickWho, style: type.subhead.copyWith(color: c.ink))),
        const SizedBox(height: MmSpace.s12),
        FoldPickerRow(folds: owned, selected: fold, onChanged: onFold),
        const SizedBox(height: MmSpace.s24),
        MobNameField(controller: name, label: MobV3Copy.joinYourName, error: nameError, onChanged: (_) => onName()),
        const SizedBox(height: MmSpace.s4),
        MobNote(MobV3Copy.nameNote),
        if (error != null) ...[
          const SizedBox(height: MmSpace.s12),
          InlineBanner(message: error!, tone: BannerTone.error),
        ],
        const SizedBox(height: MmSpace.s16),
        MobNote(MobV3Copy.joinPrivacy),
      ],
    );
  }
}

/// The Mob as the code shows it: silhouettes of the members' Folds, the name and subject, and the seats.
/// It never carries a member's name (judge F7).
class JoinPreviewCard extends StatelessWidget {
  const JoinPreviewCard({super.key, required this.preview});

  final JoinPreview preview;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final folds = preview.folds.take(4).toList();
    return Semantics(
      container: true,
      label: MobV3Copy.joinPreviewLabel(preview.name, preview.subjectName, preview.size),
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(color: c.raised, borderRadius: MmRadius.panelAll, border: Border.all(color: c.line), boxShadow: c.cardShadow),
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.s16),
            child: Row(
              children: [
                _Silhouettes(folds: folds),
                const SizedBox(width: MmSpace.s16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(MobV3Copy.joinPreviewName(preview), style: type.subhead.copyWith(color: c.ink, fontSize: 19, height: 1.2)),
                      const SizedBox(height: MmSpace.s4),
                      Text(MobV3Copy.seatsTaken(preview.size), style: type.caption.copyWith(color: c.ink2)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Silhouettes extends StatelessWidget {
  const _Silhouettes({required this.folds});

  final List<FoldKey> folds;

  @override
  Widget build(BuildContext context) {
    const h = 56.0;
    const step = 32.0;
    final width = 44 + (folds.length - 1).clamp(0, 9) * step + 8 + 34;
    return SizedBox(
      width: math.min(width, 156),
      height: h + 6,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (var i = 0; i < folds.length; i++)
            Positioned(left: i * step, bottom: 4, child: FoldPuppet(fold: folds[i], size: h, locked: true, shadow: false, blink: false)),
          Positioned(left: folds.length * step + 8, bottom: 8, child: const _DashedSeat()),
        ],
      ),
    );
  }
}

class _DashedSeat extends StatelessWidget {
  const _DashedSeat();

  @override
  Widget build(BuildContext context) => CustomPaint(painter: _DashedCircle(context.mmColors.ink3), size: const Size(30, 30));
}

class _DashedCircle extends CustomPainter {
  _DashedCircle(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    final r = Rect.fromCircle(center: size.center(Offset.zero), radius: size.width / 2 - 1);
    const n = 12;
    for (var i = 0; i < n; i++) {
      canvas.drawArc(r, i * 2 * math.pi / n, math.pi / n * 0.95, false, p);
    }
  }

  @override
  bool shouldRepaint(_DashedCircle old) => old.color != color;
}

/// A code that does not work: one sentence and one way forward.
class _StateBlock extends StatelessWidget {
  const _StateBlock({required this.sentence, required this.failed, required this.onRetry});

  final String sentence;
  final bool failed;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          liveRegion: true,
          child: DecoratedBox(
            decoration: BoxDecoration(color: c.raised, borderRadius: MmRadius.panelAll, border: Border.all(color: c.line)),
            child: Padding(
              padding: const EdgeInsets.all(MmSpace.s16),
              child: Text(sentence, style: type.body.copyWith(color: c.ink)),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        if (failed)
          KeyButton.secondary(key: const ValueKey('j1-retry'), label: MobV3Copy.tryAgain, onPressed: onRetry)
        else
          KeyButton.quiet(
            key: const ValueKey('j1-start-own'),
            label: MobV3Copy.joinStartOwn,
            expanded: true,
            onPressed: () => Navigator.of(context).maybePop(),
          ),
      ],
    );
  }
}
