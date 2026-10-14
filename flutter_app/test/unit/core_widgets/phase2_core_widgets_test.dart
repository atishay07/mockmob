// Phase 2 shared pieces: the Daylight light helpers, the theme-switch cross-fade, the skeleton to
// content swap, the one page header, the moment scaffold and the pinned action band.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/motion/mm_light.dart';
import 'package:mockmob/core/settings/appearance_settings.dart';
import 'package:mockmob/core/settings/theme_cross_fade.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';

Future<BuildContext> _context(WidgetTester tester, Brightness brightness) async {
  late BuildContext captured;
  await pumpMockmob(
    tester,
    Builder(builder: (context) {
      captured = context;
      return const SizedBox.shrink();
    }),
    brightness: brightness,
  );
  return captured;
}

int _rgb(Color c) => c.toARGB32() & 0x00FFFFFF;

void main() {
  group('MmLight: one Daylight form for every light event (MOTION.md 1.4)', () {
    testWidgets('a sweep is a 14% volt band on Day and the soft lamp-white on Night', (tester) async {
      final day = MmLight.sweepColor(await _context(tester, Brightness.light));
      expect(day.a, closeTo(0.14, 0.005));
      expect(_rgb(day), _rgb(MmColors.light.volt), reason: 'a white band is invisible on paper');

      final night = MmLight.sweepColor(await _context(tester, Brightness.dark));
      expect(_rgb(night), isNot(_rgb(MmColors.dark.volt)));
    });

    testWidgets('a chosen-row wash is 9% on Night and 16% on Day', (tester) async {
      expect(MmLight.washColor(await _context(tester, Brightness.dark)).a, closeTo(0.09, 0.005));
      expect(MmLight.washColor(await _context(tester, Brightness.light)).a, closeTo(0.16, 0.005));
    });

    testWidgets('there is no glow in Daylight, a 1 dp olive rim stands in for it', (tester) async {
      final day = await _context(tester, Brightness.light);
      expect(MmLight.glows(day), isFalse);
      expect(MmLight.glowColor(day).a, 0);
      expect(MmLight.rimColor(day), MmColors.light.accentText);
      expect(MmLight.particleRim(day)?.strokeWidth, 1);

      final night = await _context(tester, Brightness.dark);
      expect(MmLight.glows(night), isTrue);
      expect(MmLight.glowColor(night).a, greaterThan(0));
      expect(MmLight.rimColor(night).a, 0);
      expect(MmLight.particleRim(night), isNull);
    });

    testWidgets('ink is opaque volt on both themes', (tester) async {
      expect(MmLight.inkFill(await _context(tester, Brightness.light)).a, 1);
      expect(MmLight.inkFill(await _context(tester, Brightness.dark)).a, 1);
    });
  });

  group('selected surfaces (SPACING.md 8.1)', () {
    test('Night steps up, Day stays on the card colour and never uses the darker raised2', () {
      expect(MmColors.dark.selectedSurface, MmColors.dark.raised2);
      expect(MmColors.light.selectedSurface, MmColors.light.raised);
      expect(MmColors.light.selectedSurface, isNot(MmColors.light.raised2));
    });

    test('a filled mark is volt on both themes', () {
      expect(MmColors.dark.markFill, MmColors.dark.volt);
      expect(MmColors.light.markFill, MmColors.light.volt);
    });

    test('the Day sheet scrim keeps the page cream (18%, not the 26% taupe)', () {
      expect(MmColors.light.sheetScrim.a, closeTo(0.18, 0.01));
    });
  });

  group('MmSkeletonSwitcher: skeleton to content as one 200 ms cross-fade (C11)', () {
    Widget host(ValueNotifier<bool> loading) => ValueListenableBuilder<bool>(
          valueListenable: loading,
          builder: (context, value, _) => MmSkeletonSwitcher(
            loading: value,
            skeleton: const SizedBox(key: Key('skeleton'), height: 40),
            child: const SizedBox(key: Key('content'), height: 40),
          ),
        );

    testWidgets('a cache hit shows the content at once, with no skeleton flash', (tester) async {
      await pumpMockmob(tester, host(ValueNotifier(false)));
      expect(find.byKey(const Key('content')), findsOneWidget);
      expect(find.byKey(const Key('skeleton')), findsNothing);
    });

    testWidgets('when the data lands the two cross-fade, then only the content stays', (tester) async {
      final loading = ValueNotifier(true);
      await pumpMockmob(tester, host(loading));
      expect(find.byKey(const Key('skeleton')), findsOneWidget);

      loading.value = false;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byKey(const Key('skeleton')), findsOneWidget, reason: 'mid fade both are present');
      expect(find.byKey(const Key('content')), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 150));
      expect(find.byKey(const Key('skeleton')), findsNothing);
      expect(find.byKey(const Key('content')), findsOneWidget);
    });

    testWidgets('reduced motion shortens the fade to 120 ms', (tester) async {
      final loading = ValueNotifier(true);
      await pumpMockmob(tester, host(loading), disableAnimations: true);
      loading.value = false;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 130));
      expect(find.byKey(const Key('skeleton')), findsNothing);
    });
  });

  group('ThemeCrossFade: Night to Day is one deliberate fade (MOTION.md 1.4)', () {
    Future<ProviderContainer> app(WidgetTester tester, {bool reduced = false}) async {
      late ProviderContainer container;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [themeModeProvider.overrideWith(_Mode.new)],
          child: Consumer(builder: (context, ref, _) {
            container = ProviderScope.containerOf(context);
            final mode = ref.watch(themeModeProvider);
            return MaterialApp(
              theme: buildTheme(Brightness.light),
              darkTheme: buildTheme(Brightness.dark),
              themeMode: mode,
              themeAnimationDuration: Duration.zero,
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context).copyWith(disableAnimations: reduced),
                child: ThemeCrossFade(child: child!),
              ),
              home: Scaffold(body: Builder(builder: (c) => Text('x', key: const Key('probe'), style: TextStyle(color: c.mmColors.ink)))),
            );
          }),
        ),
      );
      await tester.pump();
      return container;
    }

    testWidgets('the new theme is in place at once, and no snapshot is left behind after the fade', (tester) async {
      final container = await app(tester);
      final before = tester.widget<Text>(find.byKey(const Key('probe'))).style!.color;

      (container.read(themeModeProvider.notifier) as _Mode).set(ThemeMode.light);
      await tester.pump();
      final after = tester.widget<Text>(find.byKey(const Key('probe'))).style!.color;
      expect(after, isNot(before), reason: 'no 200 ms lerp: the theme is swapped in one frame');

      await tester.pump(ThemeCrossFade.duration + const Duration(milliseconds: 50));
      expect(find.byType(RawImage), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('under reduced motion the switch is instant: no snapshot at all', (tester) async {
      final container = await app(tester, reduced: true);
      (container.read(themeModeProvider.notifier) as _Mode).set(ThemeMode.light);
      await tester.pump();
      expect(find.byType(RawImage), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });

  group('MmPageHeader: the one header of every pushed page (G2)', () {
    Widget pushed({String? caption, Widget? trailing}) => Builder(
          builder: (context) => TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => Scaffold(
                  body: SafeArea(
                    child: Column(
                      children: [MmPageHeader(title: 'Appearance and feel', caption: caption, trailing: trailing, onBack: () => Navigator.of(context).pop())],
                    ),
                  ),
                ),
              ),
            ),
            child: const Text('open'),
          ),
        );

    testWidgets('a 56 dp row, the title inline, the caption under it on the gutter', (tester) async {
      await pumpMockmob(tester, pushed(caption: 'Updated 7:30 PM'));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      expect(find.text('Appearance and feel'), findsOneWidget);
      expect(tester.getTopLeft(find.text('Updated 7:30 PM')).dx, MmSpace.gutter);
      final row = tester.getSize(find.byType(MmPageHeader)).height;
      expect(row, greaterThanOrEqualTo(MmPageHeader.rowHeight + 20));
    });

    testWidgets('the back target is 48 dp wide: a tap left of the 24 dp arrow still goes back', (tester) async {
      await pumpMockmob(tester, pushed());
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('Appearance and feel'), findsOneWidget);

      await tester.tapAt(Offset(6, tester.getCenter(find.byType(MmPageHeader)).dy));
      await tester.pumpAndSettle();
      expect(find.text('Appearance and feel'), findsNothing, reason: 'the tap reached Back and popped the page');
    });

    testWidgets('with nothing to pop it goes to the fallback route', (tester) async {
      final router = GoRouter(
        initialLocation: '/inner',
        routes: [
          GoRoute(path: '/today', builder: (_, _) => const Scaffold(body: Text('today screen'))),
          GoRoute(path: '/inner', builder: (_, _) => const Scaffold(body: SafeArea(child: MmPageHeader(title: 'Inner')))),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(ProviderScope(child: MaterialApp.router(routerConfig: router, theme: buildTheme(Brightness.light))));
      await tester.pumpAndSettle();
      await tester.tapAt(Offset(10, tester.getCenter(find.byType(MmPageHeader)).dy));
      await tester.pumpAndSettle();
      expect(find.text('today screen'), findsOneWidget);
    });
  });

  group('StateView: a retry that runs long says so (MOTION.md P1-7)', () {
    testWidgets('after 12 seconds the message line says it is still trying, and returns when the retry ends', (tester) async {
      final loading = ValueNotifier(false);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<bool>(
          valueListenable: loading,
          builder: (context, value, _) => StateView(
            kind: StateViewKind.error,
            title: 'Could not load',
            message: 'Check your connection.',
            primary: StateAction('Try again', () {}, loading: value),
          ),
        ),
      );
      loading.value = true;
      await tester.pump();
      await tester.pump(const Duration(seconds: 11));
      expect(find.text('Check your connection.'), findsOneWidget);

      await tester.pump(const Duration(seconds: 2));
      expect(find.text(StateView.slowWords), findsOneWidget);
      expect(find.text('Check your connection.'), findsNothing);

      loading.value = false;
      await tester.pump();
      expect(find.text('Check your connection.'), findsOneWidget);
    });
  });

  group('SubjectPlate: the one subject tile (G12)', () {
    testWidgets('shows the subject name, the emblem at the tile size, and answers a tap', (tester) async {
      var taps = 0;
      await pumpMockmob(
        tester,
        Center(
          child: SizedBox(width: 160, child: SubjectPlate(subject: 'accountancy', onTap: () => taps++)),
        ),
      );
      expect(find.text('Accountancy'), findsOneWidget);
      final emblem = tester.widget<SubjectEmblem>(find.byType(SubjectEmblem));
      expect(emblem.size, EmblemSizes.tile);
      expect(emblem.framed, isFalse, reason: 'the emblem sits unframed on the plate field');
      await tester.tap(find.byType(SubjectPlate));
      expect(taps, 1);
    });

    testWidgets('selected is a 2 dp ink border on both themes', (tester) async {
      for (final brightness in [Brightness.dark, Brightness.light]) {
        await pumpMockmob(
          tester,
          const Center(child: SizedBox(width: 160, child: SubjectPlate(subject: 'economics', selected: true))),
          brightness: brightness,
        );
        final decorated = tester.widgetList<DecoratedBox>(find.descendant(of: find.byType(SubjectPlate), matching: find.byType(DecoratedBox))).first;
        final shape = (decorated.decoration as ShapeDecoration).shape as OutlinedBorder;
        expect(shape.side.width, 2);
        final colors = brightness == Brightness.dark ? MmColors.dark : MmColors.light;
        expect(shape.side.color, colors.ink);
        expect((decorated.decoration as ShapeDecoration).color, colors.selectedSurface);
      }
    });
  });

  group('MomentScaffold and MmPinnedActions (G10, G11)', () {
    testWidgets('the content block sits at the optical centre and the key is pinned at the bottom', (tester) async {
      await pumpMockmob(
        tester,
        const MomentScaffold(
          header: SizedBox(height: 56),
          actions: SizedBox(key: Key('key'), height: 56, width: double.infinity),
          child: SizedBox(key: Key('block'), height: 200, width: 200),
        ),
      );
      final screen = tester.view.physicalSize / tester.view.devicePixelRatio;
      final block = tester.getCenter(find.byKey(const Key('block')));
      expect(block.dy, inInclusiveRange(screen.height * 0.34, screen.height * 0.5), reason: 'flex 2 above, flex 3 below');
      expect(block.dx, closeTo(screen.width / 2, 0.5));
      expect(tester.getBottomLeft(find.byKey(const Key('key'))).dy, greaterThan(screen.height - 60), reason: 'pinned to the bottom');
    });

    testWidgets('content taller than the room scrolls and nothing overflows', (tester) async {
      await pumpMockmob(
        tester,
        const MomentScaffold(
          actions: SizedBox(height: 56, width: double.infinity),
          child: SizedBox(key: Key('tall'), height: 2000, width: 100),
        ),
      );
      expect(tester.takeException(), isNull);
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -600));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('the pinned band fades the content above it: one 24 dp gradient, then solid ground', (tester) async {
      await pumpMockmob(
        tester,
        const Column(children: [Expanded(child: SizedBox.expand()), MmPinnedActions(child: SizedBox(height: 56, width: double.infinity))]),
      );
      final gradients = tester
          .widgetList<DecoratedBox>(find.descendant(of: find.byType(MmPinnedActions), matching: find.byType(DecoratedBox)))
          .where((d) => (d.decoration as BoxDecoration).gradient != null);
      expect(gradients, hasLength(1));
      expect(MmPinnedActions.fade, 24);
    });
  });
}

/// A theme setting a test can set without touching storage.
class _Mode extends ThemeModeSetting {
  @override
  ThemeMode build() => ThemeMode.dark;

  void set(ThemeMode mode) => state = mode;
}
