import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/mm_light.dart';
import '../../../core/motion/mm_scroll_behavior.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/router/transitions.dart' show MmRiseTransition;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../credits/data/credit_figures.dart';
import '../../social/v3/mob_v3_flags.dart' show mobV3EnabledProvider;
import '../billing_copy.dart';
import '../data/billing_controller.dart';
import '../data/play_products.dart';
import 'billing_notice.dart';
import 'pro_showcase.dart';
import 'get_pro_sheet.dart' show ProStatus, ProStatusKind, proPriceParts, proStatusOf;

/// What a caller can say on the Pro page: the moment that opened it. Every field is optional; with
/// none the page sells Pro in its own words.
class ProPageArgs {
  const ProPageArgs({this.headline, this.lede, this.personal, this.personalHeading});

  /// The page's headline (what asked for Pro), in place of "Practise without limits".
  final String? headline;

  /// The line under the headline.
  final String? lede;

  /// Lines about this student, read when the page builds (true figures only, from the caller).
  final List<String> Function(WidgetRef ref)? personal;

  /// The heading over [personal].
  final String? personalHeading;
}

/// The route builder for `/you/pro`: the arguments ride in `extra`.
Widget proPageScreen(BuildContext context, GoRouterState state) {
  final extra = state.extra;
  return ProPage(args: extra is ProPageArgs ? extra : const ProPageArgs());
}

/// Opens the full-screen Pro page. Does nothing with `PLAY_BILLING` off, so no caller needs its own
/// check and no plan word appears while billing is off.
Future<void> openProPage(BuildContext context, {ProPageArgs args = const ProPageArgs()}) async {
  final container = ProviderScope.containerOf(context, listen: false);
  if (!container.read(playBillingEnabledProvider)) return;
  final router = GoRouter.maybeOf(context);
  if (router != null && router.configuration.findMatch(Uri.parse(AppRoutes.youPro)).isNotEmpty) {
    await router.push<void>(AppRoutes.youPro, extra: args);
    return;
  }
  await Navigator.of(context, rootNavigator: true).push<void>(
    PageRouteBuilder<void>(
      fullscreenDialog: true,
      transitionDuration: Motion.emphasizedDuration,
      reverseTransitionDuration: Motion.pagePop,
      pageBuilder: (_, _, _) => ProPage(args: args),
      transitionsBuilder: (context, animation, _, child) =>
          Motion.reduced(context) ? FadeTransition(opacity: animation, child: child) : MmRiseTransition(animation: animation, child: child),
    ),
  );
}

/// The Pro page (owner I6, 19 to 20 Oct): a full screen that sells the outcome, says plainly what
/// Free has and what Pro adds, and shows Google Play's own price with one volt key. The billing is
/// the controller's: the same states as the sheets (checking Google Play, unavailable, a pending
/// payment, the server confirming, a failure with Try again, on hold, paused, a payment Google Play
/// is retrying, renewal off, Pro is on with Manage subscription). "Pro is on" and its moment only
/// ever follow the server's confirmation.
class ProPage extends ConsumerStatefulWidget {
  const ProPage({super.key, this.args = const ProPageArgs()});

  final ProPageArgs args;

  @override
  ConsumerState<ProPage> createState() => _ProPageState();
}

class _ProPageState extends ConsumerState<ProPage> with TickerProviderStateMixin {
  /// The lamp light that crosses the hero once the page has risen.
  late final AnimationController _sweep = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500));

  /// The seal pressing down when the server confirms Pro.
  late final AnimationController _stamp = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));

  bool _manageFailed = false;

  /// The confirm moment plays once, and only for a purchase confirmed while this page was open.
  bool _stamped = false;
  bool _sawSelling = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctl = ref.read(playBillingProvider.notifier);
      // An outcome from an earlier visit (a cancel, a failure) is old news on a fresh page; work in
      // progress is kept.
      ctl.clearOutcome();
      ctl.loadProducts();
      if (Motion.reduced(context)) {
        _sweep.value = 1;
      } else {
        Future<void>.delayed(const Duration(milliseconds: 380), () {
          if (mounted) _sweep.forward();
        });
      }
    });
  }

  @override
  void dispose() {
    _sweep.dispose();
    _stamp.dispose();
    super.dispose();
  }

  void _close() => Navigator.of(context).maybePop();

  Future<void> _manage() async {
    final opened = await ref.read(playBillingProvider.notifier).manageSubscription();
    if (mounted) setState(() => _manageFailed = !opened);
  }

  void _maybeStamp(ProStatus? status, PlayBillingState s) {
    if (status == null) {
      _sawSelling = true;
      return;
    }
    if (_stamped || status.kind != ProStatusKind.on || s.stage != BillingStage.confirmed || !_sawSelling) return;
    _stamped = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (Motion.reduced(context)) {
        _stamp.value = 1;
        return;
      }
      _stamp.forward(from: 0);
      Future<void>.delayed(const Duration(milliseconds: 260), () {
        if (mounted) HapticFeedback.heavyImpact();
      });
      // Then the lamp light runs across the new seal.
      Future<void>.delayed(const Duration(milliseconds: 520), () {
        if (mounted) _sweep.forward(from: 0);
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(playBillingProvider);
    final isPro = ref.watch(creditFiguresProvider.select((f) => f.isPro));
    final status = proStatusOf(s: s, isPro: isPro, sub: ref.watch(playSubscriptionProvider));
    _maybeStamp(status, s);
    final colors = context.mmColors;

    final Widget body = status == null
        ? _Selling(args: widget.args, sweep: _sweep, onClose: _close)
        : _Status(
            status: status,
            justConfirmed: _stamped,
            stamp: _stamp,
            sweep: _sweep,
            manageFailed: _manageFailed,
            onManage: _manage,
            onClose: _close,
          );

    return Scaffold(
      backgroundColor: colors.ground,
      body: MmOverlapSwitcher.fade(
        child: KeyedSubtree(key: ValueKey(status?.kind), child: body),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Selling.

class _Selling extends ConsumerWidget {
  const _Selling({required this.args, required this.sweep, required this.onClose});

  final ProPageArgs args;
  final Animation<double> sweep;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(playBillingProvider);
    final ctl = ref.read(playBillingProvider.notifier);
    final colors = context.mmColors;
    final type = context.mmType;
    final parts = proPriceParts(s);
    final working = s.stage == BillingStage.starting || s.stage == BillingStage.verifying;
    final mobOn = ref.watch(mobV3EnabledProvider);
    final personal = args.personal?.call(ref) ?? const <String>[];

    final also = <(String, String, String)>[
      (BillingCopy.alsoDifficulty.$1, BillingCopy.alsoDifficulty.$2, 'hybrid-metronome'),
      (BillingCopy.alsoInsights.$1, BillingCopy.alsoInsights.$2, 'mobi-read'),
      if (mobOn) (BillingCopy.alsoMob.$1, BillingCopy.alsoMob.$2, 'group-desk'),
    ];
    final rows = [...BillingCopy.compareRows, if (mobOn) ...BillingCopy.compareMobRows];

    var i = 0;
    Widget item(Widget child) => MmStaggerItem(index: i++, child: child);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Stack(
            children: [
              CustomScrollView(
                physics: MmScrollBehavior.page,
                slivers: [
                  SliverToBoxAdapter(
                    child: MmStagger(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          item(_Hero(
                            sweep: sweep,
                            headline: args.headline ?? BillingCopy.proPageTitle,
                            lede: args.lede ?? BillingCopy.proPageLede,
                          )),
                          _Gutter(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (personal.isNotEmpty) ...[
                                  const SizedBox(height: MmSpace.s8),
                                  item(_ForYou(heading: args.personalHeading ?? BillingCopy.proPageForYouHeading, lines: personal)),
                                  const SizedBox(height: MmSpace.s32),
                                ],
                                item(_SectionHeading(BillingCopy.proPageUnlocksHeading)),
                                const SizedBox(height: MmSpace.s12),
                                item(const ProMoment(
                                  eyebrow: BillingCopy.moment1Eyebrow,
                                  title: BillingCopy.moment1Title,
                                  line: BillingCopy.moment1LineWithPrice,
                                  stage: ProPaperFan(),
                                )),
                                const SizedBox(height: MmSpace.s16),
                                item(const ProMoment(
                                  eyebrow: BillingCopy.moment2Eyebrow,
                                  title: BillingCopy.moment2Title,
                                  line: BillingCopy.moment2Line,
                                  stage: ProSmartChart(),
                                  caption: BillingCopy.moment2Caption,
                                )),
                                const SizedBox(height: MmSpace.s16),
                                item(const ProMoment(
                                  eyebrow: BillingCopy.moment3Eyebrow,
                                  title: BillingCopy.moment3Title,
                                  line: BillingCopy.moment3Line,
                                  stage: ProNtaMockup(),
                                )),
                                const SizedBox(height: MmSpace.s32),
                                item(_SectionHeading(BillingCopy.proPageAlsoHeading)),
                                const SizedBox(height: MmSpace.s12),
                                item(ProAlsoGrid(items: also)),
                                const SizedBox(height: MmSpace.s32),
                                item(_SectionHeading(BillingCopy.proPageCompareHeading)),
                                const SizedBox(height: MmSpace.s12),
                                item(ProCompareTable(rows: rows)),
                                const SizedBox(height: MmSpace.s32),
                                item(_PriceCard(
                                  parts: parts,
                                  loading: s.productsLoading || (s.store == StoreAvailability.checking && s.products.isEmpty),
                                  unavailableMessage: s.store == StoreAvailability.unavailable
                                      ? BillingCopy.storeUnavailable
                                      : s.productsFailed
                                          ? BillingCopy.storeUnreachable
                                          : BillingCopy.productUnavailable,
                                  onRetry: () => ctl.loadProducts(force: true),
                                )),
                                const SizedBox(height: MmSpace.s16),
                                Center(
                                  child: KeyButton.quiet(label: BillingCopy.restore, onPressed: s.busy ? null : () => ctl.restore()),
                                ),
                                Text(BillingCopy.googlePlayNote, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3)),
                                const SizedBox(height: MmSpace.s24),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              Positioned(left: 0, right: 0, top: 0, child: _TopBar(onClose: onClose)),
            ],
          ),
        ),
        MmPinnedActions(
          child: _Gutter(
            padded: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                BillingNotice(ids: {PlayProducts.proId}, showRestore: true),
                const SizedBox(height: MmSpace.s12),
                KeyButton(
                  label: BillingCopy.getPro,
                  loading: working,
                  minHeight: MmTarget.primaryKey,
                  onPressed: parts == null || s.busy ? null : () => ctl.buy(PlayProducts.proId),
                ),
                const SizedBox(height: MmSpace.s8),
                Text(
                  parts == null ? BillingCopy.proRenews : '${BillingCopy.pricePer(parts.price, parts.period)}. ${BillingCopy.proRenews}',
                  textAlign: TextAlign.center,
                  style: type.caption.copyWith(color: colors.ink2),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// The content column: the page gutter, and no wider than the app's reading width.
class _Gutter extends StatelessWidget {
  const _Gutter({required this.child, this.padded = true});

  final Widget child;
  final bool padded;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: padded ? MmSpace.gutter : 0),
          child: child,
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s4, MmSpace.s4, 0),
        child: Row(
          children: [
            _CloseKey(onClose: onClose, glass: true),
          ],
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.sweep, required this.headline, required this.lede});

  final Animation<double> sweep;
  final String headline;
  final String lede;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final top = MediaQuery.paddingOf(context).top;
    return Stack(
      children: [
        // The desk and its lamp sit behind the seal only; the words below stand on clear ground.
        Positioned(left: 0, right: 0, top: 0, child: LampBackdrop(height: top + 300, parallax: false)),
        // The lamp light crossing the whole hero once, after the page has risen.
        // It fades out downward with the desk, so it never ends on a hard edge.
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: top + 360,
          child: IgnorePointer(
            child: ShaderMask(
              blendMode: BlendMode.dstIn,
              shaderCallback: (rect) => const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0x00FFFFFF)],
                stops: [0, 0.6, 1],
              ).createShader(rect),
              child: _LightSweep(progress: sweep, color: MmLight.sweepColor(context)),
            ),
          ),
        ),
        _Gutter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: top + 52),
              Center(child: _Seal(size: 148, sweep: sweep)),
              const SizedBox(height: MmSpace.s16),
              Center(child: _ProLabel(text: BillingCopy.proPageLabel)),
              const SizedBox(height: MmSpace.s12),
              Semantics(header: true, child: Text(headline, textAlign: TextAlign.center, style: type.display)),
              const SizedBox(height: MmSpace.s12),
              Text(lede, textAlign: TextAlign.center, style: type.lead.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s32),
            ],
          ),
        ),
      ],
    );
  }
}

/// The Pro page's hero art on its own (D185), for a surface that sells Pro in less room, such as the first-session
/// sheet: the lamp-lit desk with its answer sheet and the foil seal, in the page's own proportions and scaled to
/// [height], its edges dissolving into whatever it stands on, and the "MockMob Pro" label under the seal at its
/// own size.
class ProHeroArt extends StatelessWidget {
  const ProHeroArt({super.key, required this.height, this.sweep = kAlwaysCompleteAnimation, this.showLabel = true});

  final double height;

  /// The lamp light crossing the foil once; at rest by default.
  final Animation<double> sweep;

  /// The "MockMob Pro" label under the seal. Left out at large text, where the room goes to the words.
  final bool showLabel;

  /// The part of the page's hero the art keeps: from just above the seal to the foot of the answer sheet.
  static const double _cropTop = 22;
  static const Size _scene = Size(360, 236);

  /// How far the label overlaps the foot of the scene.
  static const double _labelRoom = 14;

  @override
  Widget build(BuildContext context) {
    LinearGradient dissolve(Alignment begin, Alignment end, List<double> stops) => LinearGradient(
          begin: begin,
          end: end,
          colors: const [Color(0x00FFFFFF), Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0x00FFFFFF)],
          stops: stops,
        );
    // The scene in the page's own coordinates, so it is the same picture at any size. Every edge dissolves, so
    // the lamp's pool never ends on a line.
    final scene = SizedBox.fromSize(
      size: _scene,
      child: ShaderMask(
        blendMode: BlendMode.dstIn,
        shaderCallback: (rect) => dissolve(Alignment.centerLeft, Alignment.centerRight, const [0, 0.22, 0.74, 1]).createShader(rect),
        child: ShaderMask(
          blendMode: BlendMode.dstIn,
          shaderCallback: (rect) => dissolve(Alignment.topCenter, Alignment.bottomCenter, const [0, 0.12, 0.78, 1]).createShader(rect),
          child: ClipRect(
            child: Stack(
              children: [
                // A little softer than on the page: in less room the lamp's pool would read as a lit box.
                const Positioned(left: 0, right: 0, top: -_cropTop, child: LampBackdrop(height: 300, parallax: false, strength: 0.75)),
                Positioned(left: 0, right: 0, top: 52 - _cropTop, child: Center(child: _Seal(size: 148, sweep: sweep))),
              ],
            ),
          ),
        ),
      ),
    );
    return ExcludeSemantics(
      child: SizedBox(
        height: height,
        child: Stack(
          alignment: Alignment.bottomCenter,
          children: [
            Positioned.fill(bottom: showLabel ? _labelRoom : 0, child: FittedBox(child: scene)),
            if (showLabel) _ProLabel(text: BillingCopy.proPageLabel),
          ],
        ),
      ),
    );
  }
}

/// "MockMob Pro" on a small pill with a volt dot: the plan's name, set like a stamp.
class _ProLabel extends StatelessWidget {
  const _ProLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.isNight ? colors.raised2 : colors.raised,
        borderRadius: MmRadius.pillAll,
        border: Border.all(color: colors.isNight ? colors.lineStrong : colors.accentText),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: colors.volt, shape: BoxShape.circle, border: Border.all(color: colors.voltEdge)),
            ),
            const SizedBox(width: MmSpace.s8),
            Text(text, style: context.mmType.label.copyWith(color: colors.ink)),
          ],
        ),
      ),
    );
  }
}

/// The foil seal with its glow, and the lamp light running across the foil.
class _Seal extends StatelessWidget {
  const _Seal({required this.size, required this.sweep});

  final double size;
  final Animation<double> sweep;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox(
        width: size * 1.5,
        height: size * 1.12,
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (MmLight.glows(context))
              Container(
                width: size * 1.5,
                height: size * 1.12,
                decoration: BoxDecoration(
                  gradient: RadialGradient(colors: [colors.volt.withValues(alpha: 0.16), colors.lamp.withValues(alpha: 0.06), colors.volt.withValues(alpha: 0)], stops: const [0, 0.5, 1]),
                ),
              ),
            AnimatedBuilder(
              animation: sweep,
              builder: (context, child) {
                final t = Motion.sweepCurve.transform(sweep.value);
                if (t <= 0 || t >= 1) return child!;
                final c = -0.4 + 1.8 * t;
                return ShaderMask(
                  blendMode: BlendMode.srcATop,
                  shaderCallback: (rect) => LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: const [Color(0x00FFF6E4), Color(0x99FFF6E4), Color(0x00FFF6E4)],
                    stops: [(c - 0.16).clamp(0.0, 1.0), c.clamp(0.0, 1.0), (c + 0.16).clamp(0.0, 1.0)],
                  ).createShader(rect),
                  child: child,
                );
              },
              child: _ArtFile('foil-seal', size: size),
            ),
          ],
        ),
      ),
    );
  }
}

/// A soft diagonal band of lamp light crossing its box once as [progress] runs 0 to 1.
class _LightSweep extends StatelessWidget {
  const _LightSweep({required this.progress, required this.color});

  final Animation<double> progress;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: progress,
        builder: (context, _) {
          final t = Motion.sweepCurve.transform(progress.value);
          if (t <= 0 || t >= 1) return const SizedBox.expand();
          return CustomPaint(size: Size.infinite, painter: _SweepPainter(t: t, color: color));
        },
      ),
    );
  }
}

class _SweepPainter extends CustomPainter {
  const _SweepPainter({required this.t, required this.color});

  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final band = size.width * 0.55;
    final x = -band + (size.width + band * 2) * t;
    final rect = Rect.fromLTWH(x - band, 0, band * 2, size.height);
    final paint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [color.withValues(alpha: 0), color, color.withValues(alpha: 0)],
        transform: const GradientRotation(math.pi / 14),
      ).createShader(rect);
    canvas.drawRect(Offset.zero & size, paint);
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.t != t || old.color != color;
}

/// One of the generated art files in `assets/art/`, drawn at [size]; nothing when it is missing.
class _ArtFile extends StatelessWidget {
  const _ArtFile(this.name, {required this.size});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return Image.asset(
      'assets/art/$name.webp',
      width: size,
      height: size,
      cacheWidth: (size * dpr).round(),
      fit: BoxFit.contain,
      excludeFromSemantics: true,
      errorBuilder: (_, _, _) => SizedBox(width: size, height: size),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Semantics(header: true, child: Text(text, style: context.mmType.title));
}

class _ForYou extends StatelessWidget {
  const _ForYou({required this.heading, required this.lines});

  final String heading;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmSurface.hero(
      lit: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(header: true, child: Text(heading, style: context.mmType.cardTitle)),
          const SizedBox(height: MmSpace.s8),
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: ExcludeSemantics(child: Icon(LucideIcons.sparkle, size: 16, color: colors.isNight ? colors.volt : colors.accentText)),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: Text(line, style: context.mmType.body)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// The plan: its name, Google Play's own price large with its period beside it, and the renewal
/// line. While Google Play is checked, a skeleton the price's height; when it cannot sell, why and
/// Try again.
class _PriceCard extends StatelessWidget {
  const _PriceCard({required this.parts, required this.loading, required this.unavailableMessage, required this.onRetry});

  final ({String price, String? period})? parts;
  final bool loading;
  final String unavailableMessage;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final p = parts;
    final Widget price;
    if (p != null) {
      price = Semantics(
        container: true,
        excludeSemantics: true,
        label: '${BillingCopy.proPageLabel}, ${BillingCopy.pricePer(p.price, p.period)}. ${BillingCopy.proRenews}',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // The period stays whole: on a narrow phone it goes under the figure, never split.
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.end,
              spacing: MmSpace.s8,
              children: [
                Text(p.price, style: type.figure.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                if (p.period != null)
                  Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(p.period!, style: type.lead.copyWith(color: colors.ink2))),
              ],
            ),
            const SizedBox(height: MmSpace.s8),
            Text(BillingCopy.proRenews, style: type.small.copyWith(color: colors.ink2)),
          ],
        ),
      );
    } else if (loading) {
      price = SkeletonGroup(
        label: BillingCopy.checkingStore,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Skeleton.line(width: 160, height: 47),
            const SizedBox(height: MmSpace.s8),
            Text(BillingCopy.checkingStore, style: type.small.copyWith(color: colors.ink2)),
          ],
        ),
      );
    } else {
      price = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(container: true, liveRegion: true, child: Text(unavailableMessage, style: type.body.copyWith(color: colors.ink2))),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(label: BillingCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: onRetry),
        ],
      );
    }
    return MmSurface.hero(
      lit: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(BillingCopy.proPagePriceHeading, style: type.cardTitle),
          const SizedBox(height: MmSpace.s8),
          MmOverlapSwitcher.fade(
            alignment: Alignment.topLeft,
            child: KeyedSubtree(key: ValueKey(p != null ? 'price' : (loading ? 'loading' : 'unavailable')), child: price),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Pro is on, or a subscription to fix in Google Play.

class _Status extends StatelessWidget {
  const _Status({
    required this.status,
    required this.justConfirmed,
    required this.stamp,
    required this.sweep,
    required this.manageFailed,
    required this.onManage,
    required this.onClose,
  });

  final ProStatus status;
  final bool justConfirmed;
  final Animation<double> stamp;
  final Animation<double> sweep;
  final bool manageFailed;
  final VoidCallback onManage;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final on = status.kind == ProStatusKind.on;

    final Widget art = on
        ? _StampedSeal(stamp: stamp, sweep: sweep, animate: justConfirmed)
        : ExcludeSemantics(
            child: Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(shape: BoxShape.circle, color: colors.raised2, border: Border.all(color: colors.lineStrong)),
              child: Icon(LucideIcons.triangleAlert, size: 36, color: colors.warnText),
            ),
          );

    final List<Widget> keys;
    if (on) {
      keys = [
        KeyButton(label: BillingCopy.done, minHeight: MmTarget.primaryKey, onPressed: onClose),
        if (status.canManage) Center(child: KeyButton.quiet(label: BillingCopy.manageSubscription, onPressed: onManage)),
      ];
    } else {
      keys = [
        KeyButton(label: BillingCopy.manageSubscription, minHeight: MmTarget.primaryKey, onPressed: onManage),
        Center(child: KeyButton.quiet(label: status.kind == ProStatusKind.grace ? BillingCopy.done : BillingCopy.close, onPressed: onClose)),
      ];
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Stack(
            children: [
              if (on) const Positioned(left: 0, right: 0, top: 0, child: LampBackdrop(height: 420, parallax: false)),
              MomentScaffold(
                header: Align(alignment: Alignment.centerLeft, child: _TopBarInline(onClose: onClose)),
                child: MmStagger(
                  enabled: justConfirmed || !on,
                  delay: justConfirmed ? const Duration(milliseconds: 380) : Duration.zero,
                  child: Column(
                    children: [
                      art,
                      const SizedBox(height: MmSpace.s24),
                      Semantics(
                        container: true,
                        liveRegion: true,
                        child: Column(
                          children: [
                            if (on && justConfirmed) ...[
                              MmStaggerItem(index: 0, child: _ProLabel(text: BillingCopy.proWelcome)),
                              const SizedBox(height: MmSpace.s12),
                            ],
                            MmStaggerItem(
                              index: 1,
                              child: Semantics(header: true, child: Text(status.title, textAlign: TextAlign.center, style: on ? type.display : type.headline)),
                            ),
                            const SizedBox(height: MmSpace.s12),
                            MmStaggerItem(index: 2, child: Text(status.message, textAlign: TextAlign.center, style: type.lead.copyWith(color: colors.ink2))),
                          ],
                        ),
                      ),
                      if (on) ...[
                        const SizedBox(height: MmSpace.s24),
                        MmStaggerItem(index: 3, child: _OpenNow()),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        MmPinnedActions(
          child: _Gutter(
            padded: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                ...keys,
                if (manageFailed) ...[
                  const SizedBox(height: MmSpace.s8),
                  Semantics(liveRegion: true, child: Text(BillingCopy.manageOpenFailed, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2))),
                ],
                if (!on) Text(BillingCopy.googlePlayNote, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _TopBarInline extends StatelessWidget {
  const _TopBarInline({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(left: MmSpace.s4), child: _CloseKey(onClose: onClose));
}

class _CloseKey extends StatelessWidget {
  const _CloseKey({required this.onClose, this.glass = false});

  final VoidCallback onClose;

  /// On a glass disc, for the page's top over the hero art.
  final bool glass;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final icon = Icon(LucideIcons.x, size: glass ? 20 : 22, color: colors.ink);
    return MmPressable(
      onTap: onClose,
      semanticsLabel: BillingCopy.proPageClose,
      builder: (context, _, _) => SizedBox(
        width: MmTarget.min,
        height: MmTarget.min,
        child: Center(
          child: glass
              ? DecoratedBox(
                  decoration: BoxDecoration(color: colors.glassTintLite, shape: BoxShape.circle, border: Border.all(color: colors.line)),
                  child: Padding(padding: const EdgeInsets.all(7), child: icon),
                )
              : icon,
        ),
      ),
    );
  }
}

/// What is open now, in the page's own words: every part of Pro, ticked.
class _OpenNow extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final mobOn = ref.watch(mobV3EnabledProvider);
    final names = [for (final f in BillingCopy.proFeatures) f.$1, if (mobOn) BillingCopy.proFeatureMob.$1];
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: MmSpace.s8,
      runSpacing: MmSpace.s8,
      children: [
        for (final n in names)
          DecoratedBox(
            decoration: BoxDecoration(color: colors.raised, borderRadius: MmRadius.pillAll, border: Border.all(color: colors.line)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ExcludeSemantics(child: Icon(LucideIcons.check, size: 14, color: colors.isNight ? colors.volt : colors.accentText)),
                  const SizedBox(width: MmSpace.s6),
                  Text(n, style: context.mmType.caption),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// The seal pressing down when Pro switches on: it drops from 1.3 to rest on a weighted curve while
/// a volt ring opens and fades behind it, then the lamp light runs across the foil. At rest when
/// [animate] is false (a student who is already Pro) or under reduced motion.
class _StampedSeal extends StatelessWidget {
  const _StampedSeal({required this.stamp, required this.sweep, required this.animate});

  final Animation<double> stamp;
  final Animation<double> sweep;
  final bool animate;

  // The hero seal's own size, so the image the page already decoded is the one that stamps down.
  static const double size = 148;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final ring = colors.isNight ? colors.volt : colors.accentText;
    return ExcludeSemantics(
      child: SizedBox(
        width: size * 1.7,
        height: size * 1.3,
        child: AnimatedBuilder(
          animation: stamp,
          builder: (context, child) {
            final t = animate ? stamp.value : 1.0;
            final drop = Motion.out.transform((t / 0.4).clamp(0.0, 1.0));
            final scale = 1.3 - 0.3 * drop;
            final opacity = (t / 0.18).clamp(0.0, 1.0);
            final ringT = ((t - 0.3) / 0.7).clamp(0.0, 1.0);
            final ringOn = animate && ringT > 0 && ringT < 1;
            return Stack(
              alignment: Alignment.center,
              children: [
                if (MmLight.glows(context))
                  Opacity(
                    opacity: opacity,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(colors: [colors.volt.withValues(alpha: 0.20), colors.volt.withValues(alpha: 0)]),
                      ),
                    ),
                  ),
                if (ringOn)
                  Container(
                    width: size * (0.9 + 0.7 * Motion.glide.transform(ringT)),
                    height: size * (0.9 + 0.7 * Motion.glide.transform(ringT)),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: ring.withValues(alpha: (1 - ringT) * 0.8), width: 3 * (1 - ringT) + 1),
                    ),
                  ),
                Opacity(opacity: opacity, child: Transform.scale(scale: scale, child: child)),
              ],
            );
          },
          child: _Seal(size: size, sweep: sweep),
        ),
      ),
    );
  }
}
