import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/theme.dart';
import 'routes.dart';

/// What a failed widget draws in a release build instead of nothing: a calm, honest note and a
/// way out, so a student never sits on a blank screen with no control.
///
/// Small spots (a failed icon, a chip) still draw nothing, because a message would not fit; the
/// failure is reported either way. Written to need nothing a failing subtree might lack: it
/// supplies its own text direction and Material, and finds the router only when there is one.
Widget buildErrorFallback(FlutterErrorDetails details) {
  return LayoutBuilder(
    builder: (context, constraints) {
      final roomy = constraints.maxWidth >= 200 && (!constraints.hasBoundedHeight || constraints.maxHeight >= 150);
      if (!roomy) return const SizedBox.shrink();
      return const ErrorFallback();
    },
  );
}

class ErrorFallback extends StatelessWidget {
  const ErrorFallback({super.key});

  static const String message = 'This part did not load.';
  static const String hint = 'Go back and try again.';
  static const String backLabel = 'Go back';
  static const String todayLabel = 'Go to Today';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final router = GoRouter.maybeOf(context);
    final navigator = Navigator.maybeOf(context);
    final canPop = router?.canPop() ?? navigator?.canPop() ?? false;
    final String? label = canPop ? backLabel : (router != null ? todayLabel : null);

    void leave() {
      if (canPop) {
        if (router != null) {
          router.pop();
        } else {
          navigator?.pop();
        }
      } else {
        router?.go(AppRoutes.today);
      }
    }

    return Directionality(
      textDirection: Directionality.maybeOf(context) ?? TextDirection.ltr,
      child: Material(
        type: MaterialType.transparency,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Padding(
              padding: const EdgeInsets.all(MmSpace.s24),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        message,
                        textAlign: TextAlign.center,
                        style: type.labelLarge.copyWith(color: colors.ink),
                      ),
                    ),
                    const SizedBox(height: MmSpace.s4),
                    Text(
                      hint,
                      textAlign: TextAlign.center,
                      style: type.caption.copyWith(color: colors.ink2),
                    ),
                    if (label != null) ...[
                      const SizedBox(height: MmSpace.s12),
                      TextButton(
                        onPressed: leave,
                        style: TextButton.styleFrom(minimumSize: const Size(48, 48), foregroundColor: colors.ink),
                        child: Text(label, style: type.labelLarge.copyWith(color: colors.ink)),
                      ),
                    ],
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

/// The last few failures this run, newest last. Kept in memory so a diagnostics screen or a
/// future error event can read them; nothing is sent from here (the usage-data schema has no
/// error event, and a student's choice about usage data is never bypassed).
class ErrorLog {
  ErrorLog._();

  static const int capacity = 20;
  static final List<String> _entries = <String>[];

  static List<String> get entries => List.unmodifiable(_entries);

  static void add(Object error, StackTrace? stack) {
    final text = '${DateTime.now().toUtc().toIso8601String()} $error';
    _entries.add(text.length > 400 ? text.substring(0, 400) : text);
    if (_entries.length > capacity) _entries.removeAt(0);
    // debugPrint reaches logcat in release too; the stack is kept to the first lines.
    debugPrint('Unhandled error: $error\n${_firstLines(stack, 8)}');
  }

  @visibleForTesting
  static void reset() => _entries.clear();

  static String _firstLines(StackTrace? stack, int n) => stack == null ? '' : stack.toString().split('\n').take(n).join('\n');
}
