import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/entrance.dart';
import '../widgets/welcome_scene.dart';

/// Welcome (brief section 11, step 2): the lamp-lit desk drawn in code, Mobi standing on it and
/// waving hello (yawning from 11 PM, asleep from 1 to 5 AM until a tap wakes him), the promise and
/// one dominant key. Works with no network. A student with a sheet in progress gets "Pick up my
/// sheet" instead.
class WelcomeView extends StatefulWidget {
  const WelcomeView({
    super.key,
    required this.onStart,
    required this.onHaveAccount,
    this.returning = false,
    this.filled = 0,
    this.lateNight = false,
    this.entrance = MobiAct.hello,
    this.animate = true,
    this.pending = false,
    this.notice,
    this.retry = false,
    this.onStartOver,
  });

  /// From 11 PM until 5 AM: one honest line about the hour.
  final bool lateNight;

  /// How Mobi greets (MobiMoments.entranceAt): hello, sleepy from 11 PM, asleep from 1 to 5 AM.
  /// Asleep, he says nothing until a tap wakes him.
  final MobiAct entrance;

  final VoidCallback onStart;
  final VoidCallback onHaveAccount;

  /// A sheet is in progress on this phone.
  final bool returning;

  /// How many of its bubbles are filled, for the return line.
  final int filled;
  final bool animate;

  /// The key was tapped while the stored sheet is still being read: it waits, then opens.
  final bool pending;

  /// One line about a stored sheet that could not be read, above the key.
  final String? notice;

  /// The key reads the stored sheet again ("Try again") instead of starting.
  final bool retry;

  /// Offered beside Try again when the saved sheet can be neither read nor kept aside: starts a
  /// new sheet after the student confirms, so the screen always has a way forward.
  final VoidCallback? onStartOver;

  /// Welcome is a moment (type and art, no cards): it sits on the moment gutter (SPACING.md 1.1).
  static const double gutter = MmSpace.s24;

  @override
  State<WelcomeView> createState() => _WelcomeViewState();
}

class _WelcomeViewState extends State<WelcomeView> {
  final MobiController _mobi = MobiController();

  /// A tap woke a sleeping Mobi, so he says his line now.
  bool _woken = false;

  bool get _asleep => widget.entrance == MobiAct.sleep && !_woken;

  @override
  void didUpdateWidget(WelcomeView old) {
    super.didUpdateWidget(old);
    // Shown asleep, seen again after 5 AM: he wakes once, then greets as usual.
    if (old.entrance == MobiAct.sleep && widget.entrance != MobiAct.sleep && !_woken) {
      _woken = true;
      _mobi.play(MobiAct.wake);
    }
  }

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  /// The line Mobi is saying now, so a rebuild never says it twice.
  String? _said;

  void _sayOnce(String? line) {
    if (line == _said) return;
    _said = line;
    if (line == null) {
      _mobi.hush();
    } else {
      _mobi.say(line);
    }
  }

  void _wake() {
    // The character plays its own wake on the tap; the line follows it.
    if (widget.entrance != MobiAct.sleep || _woken) return;
    setState(() => _woken = true);
  }

  /// Welcome is lamp-lit in both themes, like the opening it follows: one dark room, one
  /// painting, so Day does not get a second, paler first impression.
  static final ThemeData _night = buildTheme(Brightness.dark);

  @override
  Widget build(BuildContext context) => Theme(
        data: _night,
        child: AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle.light,
          child: Builder(builder: _room),
        ),
      );

  Widget _room(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final size = MediaQuery.sizeOf(context);
    final pad = MediaQuery.paddingOf(context);
    final lateNight = widget.lateNight;
    final returning = widget.returning;
    final notice = widget.notice;
    final line = _asleep
        ? null
        : (lateNight ? OnboardingCopy.lateNight : (returning ? OnboardingCopy.mobiWelcomeBack : OnboardingCopy.mobiWelcome));
    // On a short screen (the 360 by 640 floor) Mobi's bubble would run up into the wordmark, so
    // it waits: the greeting is the headline's job there, and the late-night line moves to sit
    // above the key as plain text. The room grows with the screen and shrinks with large text.
    final scale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.3);
    final bubbleRoom = size.height >= 760 + (scale - 1) * 250;
    final sayLine = bubbleRoom ? line : null;

    // The painted room fills the screen behind everything; Mobi stands in its lit ellipse, as
    // large as the painting says (shrunk only to stay under the wordmark), and his line sits above
    // him to the left, over the bookshelf, ending before the pinned sheet so it never covers it.
    final wordmarkBottom = pad.top + MmSpace.s16 + 26 + MmSpace.s16;
    final room = LayoutBuilder(
      builder: (context, box) {
        final layout = WelcomeHeroLayout.of(size, room: box.maxHeight, topLimit: wordmarkBottom);
        final mobiSize = layout.mobiHeight;
        final mobiBox = mobiSize * 1.5;
        final bubbleMax = math.max(0.0, layout.image.left + layout.image.width * WelcomeHeroLayout.sheetLeft - WelcomeView.gutter);
        return Stack(
          clipBehavior: Clip.none,
          children: [
            // Runs past the room's foot (under the words): the painting ends in the ground.
            Positioned(
              left: 0,
              top: 0,
              width: size.width,
              height: size.height,
              child: IgnorePointer(child: WelcomeHero(layout: layout, animate: widget.animate)),
            ),
            if (mobiSize >= 80)
              Positioned(
                left: layout.feet.dx - mobiBox / 2,
                width: mobiBox,
                top: layout.feet.dy - mobiSize,
                height: mobiSize,
                child: Listener(
                  onPointerUp: (_) => _wake(),
                  child: MobiStage(
                    controller: _mobi,
                    size: mobiSize,
                    entrance: widget.entrance,
                    lamp: false,
                    bubble: false,
                    semanticLabel: switch (widget.entrance) {
                      MobiAct.sleep => _woken ? OnboardingCopy.mobiSleepy : OnboardingCopy.mobiAsleep,
                      MobiAct.sleepy => OnboardingCopy.mobiSleepy,
                      _ => OnboardingCopy.mobiHello,
                    },
                  ),
                ),
              ),
            if (sayLine != null && bubbleMax >= 160)
              Positioned(
                left: WelcomeView.gutter,
                width: bubbleMax,
                bottom: box.maxHeight - (layout.feet.dy - mobiSize) + MmSpace.s4,
                child: Align(
                  alignment: Alignment.bottomLeft,
                  child: ValueListenableBuilder<MobiSpeech?>(
                    valueListenable: _mobi.speech,
                    builder: (context, speech, _) => speech == null
                        ? const SizedBox.shrink()
                        : MobiBubble(key: ValueKey(speech.id), speech: speech, maxWidth: bubbleMax),
                  ),
                ),
              ),
          ],
        );
      },
    );
    _sayOnce(sayLine);

    // The words build after Mobi has started his wave: the headline rises word by word, the
    // promise lifts, then the key (ui-blitz onboarding, Welcome).
    final words = Padding(
      padding: EdgeInsets.fromLTRB(WelcomeView.gutter, MmSpace.s8, WelcomeView.gutter, pad.bottom + MmSpace.s12),
      child: StepEntrance(
        delay: const Duration(milliseconds: 260),
        child: Builder(builder: (context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            header: true,
            label: OnboardingCopy.welcomeHeadline,
            excludeSemantics: true,
            child: RiseHeadline(
              OnboardingCopy.welcomeHeadlineSet,
              style: type.moment,
              at: const Duration(milliseconds: 260),
              textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          EntranceItem(
            at: const Duration(milliseconds: 520),
            rise: 8,
            child: Text(OnboardingCopy.welcomeSupport, style: type.body.copyWith(color: colors.ink2)),
          ),
          const SizedBox(height: MmSpace.s24),
          if (!bubbleRoom && lateNight && !_asleep) ...[
            Semantics(liveRegion: true, child: Text(OnboardingCopy.lateNight, style: type.small.copyWith(color: colors.ink2))),
            const SizedBox(height: MmSpace.s12),
          ],
          if (returning) ...[
            Row(
              children: [
                BubbleRow(
                  states: [for (var i = 0; i < 7; i++) i < widget.filled ? BubbleState.filled : BubbleState.hollow],
                  bubbleSize: 12,
                  gap: MmSpace.s4,
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Text(OnboardingCopy.welcomeBackLine(widget.filled, 7), maxLines: 1, overflow: TextOverflow.ellipsis, style: type.small.copyWith(color: colors.ink2)),
                ),
              ],
            ),
            const SizedBox(height: MmSpace.s20),
          ],
          if (notice != null) ...[
            Semantics(liveRegion: true, child: Text(notice, style: type.small.copyWith(color: colors.ink2))),
            const SizedBox(height: MmSpace.s12),
          ],
          EntranceItem(
            at: const Duration(milliseconds: 600),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                KeyButton(
                  label: widget.retry ? OnboardingCopy.tryAgain : (returning ? OnboardingCopy.continuePlan : OnboardingCopy.buildPlan),
                  onPressed: widget.onStart,
                  loading: widget.pending,
                ),
                const SizedBox(height: MmSpace.s4),
                if (widget.onStartOver != null)
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: MmSpace.s8,
                    children: [
                      KeyButton.quiet(label: OnboardingCopy.startOver, onPressed: widget.onStartOver),
                      KeyButton.quiet(label: OnboardingCopy.haveAccount, onPressed: widget.onHaveAccount),
                    ],
                  )
                else
                  Align(child: KeyButton.quiet(label: OnboardingCopy.haveAccount, onPressed: widget.onHaveAccount)),
              ],
            ),
          ),
        ],
      )),
      ),
    );

    return ColoredBox(
      color: colors.ground,
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [Expanded(child: room), words],
          ),
          const Positioned.fill(child: IgnorePointer(child: Grain())),
          Positioned(
            left: WelcomeView.gutter,
            top: pad.top + MmSpace.s16,
            child: Wordmark(height: 26, color: colors.ink),
          ),
        ],
      ),
    );
  }
}
