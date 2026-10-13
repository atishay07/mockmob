import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// The Night Sheet golden frame: 384 by 853 logical px at DPR 2.
const Size kTodaySize = Size(384, 853);

/// A phone's status bar and gesture inset.
const EdgeInsets kPhoneInsets = EdgeInsets.only(top: 32, bottom: 20);

const AuthSnapshot ashaAuth = AuthSnapshot(status: AuthStatus.signedIn, userId: 'user-1', name: 'Asha Verma');

List<Override> get todayOverrides => [authSnapshotProvider.overrideWithBuild((ref, notifier) => ashaAuth)];

TodayCallbacks get noopCallbacks => TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_) {}, onShowMe: (_) {}, onWeek: () {});

/// Today as the shell shows it: phone insets, the dock floating over the content, and the
/// content's bottom padding raised by the dock's clearance.
class PhoneFrame extends StatelessWidget {
  const PhoneFrame({super.key, required this.child, this.dock = true});

  final Widget child;
  final bool dock;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final clearance = MmDock.height + MmDock.lift + 8;
    final insets = media.copyWith(padding: kPhoneInsets, viewPadding: kPhoneInsets);
    return MediaQuery(
      data: insets,
      child: BackdropGroup(
        child: Stack(
          children: [
            Positioned.fill(
              child: MediaQuery(
                data: insets.copyWith(padding: kPhoneInsets.copyWith(bottom: kPhoneInsets.bottom + (dock ? clearance : 0))),
                child: child,
              ),
            ),
            if (dock)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: SplitDock(currentIndex: 0, onTab: (_) {}, onStart: (_) {}),
              ),
          ],
        ),
      ),
    );
  }
}

/// Renders Today for [view] in both themes as `<name>_<night|day>.png`.
void todayGolden(String name, TodayView Function() view, {Size size = kTodaySize, double scrollTo = 0, bool dock = true}) {
  screenGolden(
    name,
    () => _Scrolled(offset: scrollTo, builder: (controller) => TodayBody(view: view(), callbacks: noopCallbacks, controller: controller, skeletonDelay: Duration.zero)),
    size: size,
    dock: dock,
    settle: scrollTo > 0,
  );
}

/// Any widget in the phone frame, both themes.
void screenGolden(String name, Widget Function() build, {Size size = kTodaySize, bool dock = true, bool settle = false}) {
  setUpAll(loadAppFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(key: boundary, child: PhoneFrame(dock: dock, child: build())),
        brightness: brightness,
        size: size,
        disableAnimations: true,
        overrides: todayOverrides,
      );
      if (settle) await tester.pumpAndSettle();
      await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/${name}_$tag.png'));
      await _preview(tester, boundary, '${name}_$tag');
    });
  }
}

class _Scrolled extends StatefulWidget {
  const _Scrolled({required this.offset, required this.builder});

  final double offset;
  final Widget Function(ScrollController controller) builder;

  @override
  State<_Scrolled> createState() => _ScrolledState();
}

class _ScrolledState extends State<_Scrolled> {
  late final ScrollController _controller = ScrollController(initialScrollOffset: widget.offset);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(_controller);
}

/// With `MM_PREVIEW_DIR` set, also writes a DPR 2 render for close review.
Future<void> _preview(WidgetTester tester, GlobalKey key, String name) async {
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}
