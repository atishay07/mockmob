import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../haptics/haptics.dart';
import '../mascot/mobi_ration.dart' show MobiCelebrationLevel, MobiCelebrations;
import '../motion/flight.dart';
import '../motion/motion.dart';
import '../theme/theme.dart';
import 'emblem_painter.dart';
import 'emblem_sparkle.dart';
import 'emblem_palette.dart';
import 'emblem_sizes.dart';
import 'emblem_subjects.dart';
import 'object_art.dart';
import 'object_life.dart';
import 'subject_identity.dart';

/// A subject's emblem: one folded-paper object on a piece of the subject's answer sheet, printed
/// in its form ink, with exactly one volt bubble placed where it means something (the
/// equilibrium point, the nucleus, the ballot's choice).
///
/// With [objectArt] on (the app's default), every size from 40 dp up shows the subject's
/// photo-real object instead ([SubjectRender]: the ledger tied with string, the brass stamp, the
/// scale with an onion): centred and wholly inside its box, never cropped, with a soft contact
/// shadow, on a quiet well when framed. The 24 dp glyph and a subject without a render keep the
/// drawing below. Marked, a framed tile shows the volt ring and tick; an open emblem carries no
/// mark of its own (a photo has no bubble to ink), so its row's check or ring says it, as below.
/// The idle float, the picker's dim and lift, and the semantics are the same.
///
/// - [size] is the side in dp, legible from 24 to 160. Use the four sizes of [EmblemSizes]
///   (24, 40, 56, 136) so a subject is the same object on every screen. Detail follows size (see
///   [EmblemDetail]). A size that is not a positive finite number draws nothing and takes no room.
/// - [animate] turns on the idle cycle (7.2 s, phase-shifted per subject): a float on every object
///   and one signature motion per subject (the atom's orbit sweep, the flask's bubbles, the
///   code window's scan, the heads' nod). Off under reduced motion (system or in-app), off by
///   default, paused while the subtree is under `TickerMode(enabled: false)` (an offstage route or
///   tab), and off everywhere until [idleEnabled] is set (the app sets it in `main()`; tests keep
///   it off so `pumpAndSettle` settles).
/// - [marked] inks the volt mark and is off by default, so a row that is not a choice never shows
///   a pick. Changing it inks or clears it in 260 ms (snaps under reduced motion). The caller owns
///   the haptic (`HapticFeedback.selectionClick`). Pair a picked state with a visible check or ring
///   on the card: the ink alone is colour.
/// - [selectable] marks the emblem as a choice (a picker tile). Unmarked it sits slightly small and
///   dimmed; marked it lifts to full size, a framed tile shows a volt ring and a tick in its lower
///   right corner, and the mark is inked. The semantics node reports selected or not (needs
///   [semanticLabel]). Without it [marked] only inks the mark.
/// - The volt mark takes a different form per subject: a key, a clasp, a ring, an ink drop, a swept
///   angle. All of them are the one mark.
/// - [framed] false drops the tile, for an emblem standing on its own light field.
/// - [brightness] overrides the theme's (for a Night card inside a Daylight screen).
///
/// Decorative unless [semanticLabel] is given: the row it sits in names the subject.
///
/// **Life** (feature wave 1015, M2; numbers in [ObjectLife], shared with the website). A photo-real
/// object of [ObjectLife.minSize] dp or more is alive by default ([life]): it floats as [animate]
/// does, springs at 0.4 when tapped (with one tick and its sparkle; the tap still reaches the card
/// around it), and, standing open, leans toward a finger resting on it and toward the scroll of
/// its list with one band of lamp light crossing its own pixels while it leans ([MmObjectLife]).
/// The low glass tiers keep the float only; reduced motion keeps it flat; Celebrations Quiet or Off
/// mute the sparkle. A smaller object, and every drawn emblem, keeps today's look.
///
/// **Flight.** Every photo-real object is an [MmFlightPoint]: `MmFlight.launch` from a tapped card
/// flies its object into the next screen, onto the object of the same subject there, which stays
/// hidden until it lands and then answers with a 0.4 spring.
class SubjectEmblem extends StatefulWidget {
  const SubjectEmblem({
    super.key,
    required this.subject,
    this.size = EmblemSizes.tile,
    this.animate = false,
    this.marked = false,
    this.selectable = false,
    this.framed = true,
    this.brightness,
    this.semanticLabel,
    this.reaction,
    this.sparkle = true,
    this.life,
  }) : _flightLift = null;

  /// The copy an [MmFlight] draws: open, still, decorative, its float pose set by [lift].
  const SubjectEmblem._flight({required this.subject, required this.size, required this.brightness, required ValueListenable<double> lift})
      : animate = false,
        marked = false,
        selectable = false,
        framed = false,
        semanticLabel = null,
        reaction = null,
        sparkle = false,
        life = false,
        _flightLift = lift;

  /// The object's life (see the class notes): null gives it to photo-real objects of
  /// [ObjectLife.minSize] dp and up; false keeps an object as a still picture.
  final bool? life;

  final ValueListenable<double>? _flightLift;

  /// Each change of this value makes the object answer a touch ([MmObjectReact]: it gives, springs
  /// past rest and settles, with a light haptic) and, with [sparkle], its subject light blooms
  /// once behind it with four glints ([EmblemSparkle]). Bump it from the tap that touched the
  /// object, never on a timer. Null: the emblem does not react.
  final ValueListenable<int>? reaction;

  /// The one-shot light with each [reaction].
  final bool sparkle;

  /// Any subject id the app meets (`accountancy`, `business_studies`, `gat`, `hindi`, ...).
  final String? subject;
  final double size;
  final bool animate;
  final bool marked;

  /// True where the emblem stands for a choice (a picker tile): the semantics node then reports
  /// selected or not. The caller should pair it with a visible cue other than colour, such as a
  /// check or a ring on the card.
  final bool selectable;
  final bool framed;
  final Brightness? brightness;
  final String? semanticLabel;

  /// The app-wide gate for the idle drift. `main()` turns it on; tests keep the static default
  /// (off) so a screen with an animated emblem settles under `pumpAndSettle`. A test that checks
  /// the drift itself turns it on and restores it in a tear-down.
  static bool idleEnabled = false;

  /// The app-wide gate for the photo-real objects at 40 dp and up. `main()` turns it on; tests
  /// keep the static default (off), so the drawn emblems in every other golden stay as they are.
  /// A test that checks the objects turns it on and restores it in a tear-down.
  static bool objectArt = false;

  @override
  State<SubjectEmblem> createState() => _SubjectEmblemState();
}

class _SubjectEmblemState extends State<SubjectEmblem> with TickerProviderStateMixin implements MmFlightPoint {
  static const Duration idlePeriod = ObjectLife.floatPeriod;

  /// A framed tile's well fades in under an object that has just landed on it.
  static const Duration _wellReveal = Duration(milliseconds: 140);

  AnimationController? _idle;
  late final AnimationController _ink;
  final ValueNotifier<double> _still = ValueNotifier<double>(0);
  bool _reduced = false;
  bool _tickerOn = true;

  /// The render's file would not load (a broken install): draw the vector object instead.
  bool _renderMissing = false;

  /// Hidden while a flight draws this object elsewhere.
  late final AnimationController _shown;

  /// A tap on a living object (its sparkle), and the spring that answers a tap or a landing.
  final ValueNotifier<int> _tap = ValueNotifier<int>(0);
  final ValueNotifier<int> _react = ValueNotifier<int>(0);

  bool _registered = false;
  Route<Object?>? _route;

  SubjectIdentity get _identity => SubjectIdentity.of(widget.subject) ?? SubjectIdentity.of('other')!;

  /// The photo-real object this emblem shows, or null for a drawn one.
  SubjectRender? get _render {
    final side = widget.size;
    if (!SubjectEmblem.objectArt || !side.isFinite || side < EmblemSizes.chip || _renderMissing) return null;
    return SubjectRender.forKind(_identity.kind);
  }

  bool get _isCopy => widget._flightLift != null;

  /// Alive by size (or as asked), for a photo-real object only.
  bool get _alive => !_isCopy && _render != null && (widget.life ?? widget.size >= ObjectLife.minSize);

  @override
  void initState() {
    super.initState();
    // Created here, not on first use: a build that returns early (no room to draw) must still
    // leave a controller to dispose.
    _ink = AnimationController(vsync: this, duration: Motion.ink, value: widget.marked ? 1 : 0);
    _shown = AnimationController(vsync: this, duration: _wellReveal, value: 1);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = Motion.reduced(context);
    _tickerOn = TickerMode.valuesOf(context).enabled;
    _route = ModalRoute.of(context);
    _syncIdle();
    _syncFlight();
    if (_reduced && _ink.isAnimating) _ink.value = widget.marked ? 1 : 0;
  }

  @override
  void didUpdateWidget(SubjectEmblem old) {
    super.didUpdateWidget(old);
    // The setting may change in the same frame as the props; read it fresh.
    _reduced = Motion.reduced(context);
    if (old.subject != widget.subject) _renderMissing = false;
    if (old.animate != widget.animate || old.life != widget.life || old.size != widget.size || old.subject != widget.subject) _syncIdle();
    _syncFlight();
    if (old.marked != widget.marked) {
      final target = widget.marked ? 1.0 : 0.0;
      if (_reduced) {
        _ink.value = target;
      } else {
        _ink.animateTo(target, duration: widget.marked ? Motion.ink : Motion.exitDuration, curve: widget.marked ? Motion.emphasized : Motion.exit);
      }
    }
  }

  void _syncIdle() {
    final run = (widget.animate || _alive) && !_reduced && SubjectEmblem.idleEnabled;
    if (run) {
      final idle = _idle ??= AnimationController(vsync: this, duration: idlePeriod);
      // Offstage (TickerMode off) the drift holds its pose and takes no ticks; it resumes from
      // the same phase when the route or tab is shown again.
      if (!_tickerOn) {
        if (idle.isAnimating) idle.stop(canceled: false);
      } else if (!idle.isAnimating) {
        idle.repeat();
      }
    } else if (_idle != null) {
      _idle!.dispose();
      _idle = null;
    }
  }

  void _onRenderMissing() {
    if (_renderMissing) return;
    // Called from the image's error builder, inside a build: switch on the next frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _renderMissing) return;
      setState(() => _renderMissing = true);
      _syncIdle();
      _syncFlight();
    });
  }

  /// A photo-real object is a place a flight can leave from or land on.
  void _syncFlight() {
    final want = !_isCopy && _render != null;
    if (want && !_registered) {
      _registered = true;
      MmFlight.register(this, _route);
      // A flight for this object may be waiting for this very screen: never show for a frame first.
      if (MmFlight.awaits(this)) _shown.value = 0;
    } else if (!want && _registered) {
      _registered = false;
      MmFlight.unregister(this);
      _shown.value = 1;
    } else if (_registered) {
      MmFlight.updateRoute(this, _route);
    }
  }

  @override
  void dispose() {
    if (_registered) MmFlight.unregister(this);
    _idle?.dispose();
    _ink.dispose();
    _shown.dispose();
    _still.dispose();
    _tap.dispose();
    _react.dispose();
    super.dispose();
  }

  // ---- MmFlightPoint ------------------------------------------------------------------------

  @override
  Object get flightKey => _render ?? this;

  @override
  bool carries(String subjectId) {
    final render = _render;
    return render != null && identical(SubjectRender.of(subjectId), render);
  }

  @override
  double get flightPriority => widget.size;

  @override
  Rect? get objectRect {
    final render = _render;
    final box = context.findRenderObject();
    if (render == null || box is! RenderBox || !box.hasSize || !box.attached) return null;
    return MatrixUtils.transformRect(box.getTransformTo(null), render.rectIn(widget.size, framed: widget.framed));
  }

  @override
  MmFlightCopy? get flightCopy {
    final render = _render;
    // Only an open object leaves: its copy is the same picture, decoded at the same size.
    if (render == null || widget.framed || !mounted) return null;
    final side = widget.size;
    final subject = widget.subject;
    final brightness = widget.brightness ?? Theme.of(context).brightness;
    return MmFlightCopy(
      size: Size.square(side),
      objectIn: render.rectIn(side, framed: false),
      build: (lift) => SubjectEmblem._flight(subject: subject, size: side, brightness: brightness, lift: lift),
    );
  }

  @override
  double get flightLift => objectLift(_idle?.value ?? 0, _identity.phase);

  @override
  Duration get revealDuration => widget.framed && !_reduced ? _wellReveal : Duration.zero;

  @override
  void setFlightHidden(bool hidden) {
    if (!mounted) return;
    if (hidden) {
      _shown.value = 0;
      return;
    }
    if (_shown.value >= 1) return;
    // The landed copy stood on the ground: the float picks up from there, not from its phase.
    final idle = _idle;
    if (idle != null) {
      idle.value = (1 - _identity.phase) % 1.0;
      if (_tickerOn) idle.repeat();
    }
    if (revealDuration > Duration.zero) {
      _shown.animateTo(1, duration: revealDuration, curve: Motion.out);
    } else {
      _shown.value = 1;
    }
  }

  @override
  void flightLanded({required bool back}) {
    if (!mounted || back) return;
    _react.value++;
  }

  /// A tap on a living object: its spring, one tick, and the sparkle (muted by Celebrations).
  void _tapped() {
    if (!mounted) return;
    hapticsOf(context)?.tick();
    _react.value++;
    _tap.value++;
  }

  @override
  Widget build(BuildContext context) {
    // A size that is zero, negative, NaN or infinite (a LayoutBuilder with no room, a divide by
    // zero in a caller) takes no space and paints nothing instead of throwing in layout.
    final side = widget.size;
    if (!side.isFinite || side <= 0) return const SizedBox.shrink();
    final brightness = widget.brightness ?? Theme.of(context).brightness;
    final identity = _identity;
    final palette = EmblemPalette.of(identity, brightness);
    final render = _render;
    final copyLift = widget._flightLift;
    if (render != null) {
      final object = RepaintBoundary(
        child: ObjectEmblem(
          render: render,
          size: side,
          palette: palette,
          framed: widget.framed,
          selectable: widget.selectable,
          idle: copyLift != null ? _LiftPose(copyLift, identity.phase) : (_idle ?? _still),
          ink: _ink,
          phase: identity.phase,
          reduced: _reduced,
          onMissing: _onRenderMissing,
        ),
      );
      if (copyLift != null) return ExcludeSemantics(child: object);
      return _withSemantics(_alive ? _living(object, render, brightness) : object, flight: true);
    }
    final detail = EmblemDetail.forSize(widget.size);
    final known = EmblemArt.forKind(identity.kind);
    final art = known ?? EmblemArt.monogram;

    Widget emblem = CustomPaint(
      size: Size.square(widget.size),
      isComplex: true,
      // A drifting emblem changes every frame: do not ask the raster cache to keep it.
      willChange: _idle != null,
      painter: EmblemPainter(
        subject: identity,
        art: art,
        palette: palette,
        brightness: brightness,
        detail: detail,
        framed: widget.framed,
        idle: _idle ?? _still,
        ink: _ink,
        inking: () => _ink.isAnimating && _ink.velocity > 0,
        phase: identity.phase,
        selectable: widget.selectable,
      ),
    );
    if (known == null) {
      // Initials on the printed card: heavy, set in the deep ink with a lit edge under them.
      final glyph = detail == EmblemDetail.glyph;
      final fontSize = widget.size * (glyph ? 0.37 : 0.34);
      final letters = SubjectIdentity.monogram(widget.subject);
      Widget letterBox(double k) => Opacity(
            opacity: widget.selectable ? 0.6 + 0.4 * k : 1,
            child: Transform.scale(
              scale: widget.selectable ? (widget.framed ? 0.92 + 0.06 * k : 0.94 + 0.08 * k) : 1,
              child: Align(
                alignment: Alignment(0, (0.42 - 0.5) * 2),
                child: Text(
                  letters,
                  textScaler: TextScaler.noScaling,
                  maxLines: 1,
                  style: context.mmType.labelLarge.copyWith(
                    fontFamily: 'BricolageTitle',
                    fontSize: fontSize,
                    height: 1,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -fontSize * 0.02,
                    color: palette.deep,
                  ),
                ),
              ),
            ),
          );
      emblem = Stack(
        alignment: Alignment.center,
        children: [
          emblem,
          if (widget.selectable) AnimatedBuilder(animation: _ink, builder: (_, _) => letterBox(_ink.value.clamp(0.0, 1.0))) else letterBox(0),
        ],
      );
    }
    return _withSemantics(RepaintBoundary(child: SizedBox.square(dimension: widget.size, child: emblem)));
  }

  /// The living object: it leans and catches the light (open objects, on the full glass tier), and
  /// springs and sparkles when tapped (unless its owner answers taps itself through [reaction]).
  Widget _living(Widget object, SubjectRender render, Brightness brightness) {
    if (GlassScope.of(context) != GlassQuality.full) return object;
    final o = render.rectIn(widget.size, framed: widget.framed);
    final ownTap = widget.reaction == null;
    Widget out;
    if (widget.framed) {
      out = ownTap ? GestureDetector(behavior: HitTestBehavior.translucent, onTap: _tapped, excludeFromSemantics: true, child: object) : object;
    } else {
      out = MmObjectLife(
        object: o,
        // The light stops above the foot, so the contact shadow is never brightened.
        lit: Rect.fromLTRB(o.left, o.top, o.right, o.top + o.height * math.max(0.0, render.ground - 0.06)),
        brightness: brightness,
        onTap: ownTap ? _tapped : null,
        child: object,
      );
    }
    if (ownTap && widget.sparkle && MobiCelebrations.of(context) == MobiCelebrationLevel.full) {
      out = EmblemSparkle(pulse: _tap, light: SubjectLight.forSubject(widget.subject), brightness: brightness, child: out);
    }
    return out;
  }

  Widget _withSemantics(Widget boxed, {bool flight = false}) {
    if (flight && _registered) {
      // The spring that answers a landing (and a living object's tap), about the foot; and hidden
      // while a flight draws this object elsewhere.
      boxed = FadeTransition(
        opacity: _shown,
        child: MmObjectReact(pulse: _react, amplitude: ObjectLife.tapAmplitude, haptic: false, alignment: Alignment.bottomCenter, child: boxed),
      );
    }
    final pulse = widget.reaction;
    if (pulse != null) {
      final amplitude = (widget.size / EmblemSizes.hero).clamp(0.5, 1.0);
      boxed = MmObjectReact(pulse: pulse, amplitude: amplitude, alignment: Alignment.bottomCenter, child: boxed);
      // Celebrations Quiet and Off keep the spring and mute the light.
      if (widget.sparkle && MobiCelebrations.of(context) == MobiCelebrationLevel.full) {
        boxed = EmblemSparkle(
          pulse: pulse,
          light: SubjectLight.forSubject(widget.subject),
          brightness: widget.brightness ?? Theme.of(context).brightness,
          child: boxed,
        );
      }
    }
    final label = widget.semanticLabel;
    if (label == null) return ExcludeSemantics(child: boxed);
    return Semantics(
      label: label,
      image: true,
      selected: widget.selectable ? widget.marked : null,
      excludeSemantics: true,
      child: boxed,
    );
  }
}

/// A flight copy's float pose as the idle cycle position that draws it: [lift] 0 on the ground,
/// 1 at the top of the float, for an object of [phase].
class _LiftPose implements ValueListenable<double> {
  _LiftPose(this.lift, this.phase);

  final ValueListenable<double> lift;
  final double phase;

  @override
  double get value {
    final l = lift.value.clamp(0.0, 1.0);
    if (l <= 0) return 0;
    final t = math.acos(1 - 2 * l) / (2 * math.pi);
    final v = (t - phase) % 1.0;
    // Exactly 0 reads as still (on the ground); nudge it so a lifted pose is kept.
    return v == 0 ? 1e-6 : v;
  }

  @override
  void addListener(VoidCallback listener) => lift.addListener(listener);

  @override
  void removeListener(VoidCallback listener) => lift.removeListener(listener);
}
