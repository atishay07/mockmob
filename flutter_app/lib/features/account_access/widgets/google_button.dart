import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';
import '../access_gateway.dart';
import 'access_field.dart';

/// Where "Continue with Google" is.
enum GooglePhase {
  idle,

  /// The native account sheet is open, or the browser is being opened.
  opening,

  /// The browser is open; waiting for the student to come back through the callback link.
  inBrowser,

  /// Google answered and the session is being set up; the router moves on from here.
  signingIn,
}

/// "Continue with Google", choosing the method by itself: the one-tap account sheet when this
/// build has the Google web client id and the sheet works on the phone, else the same browser
/// sign-in the website uses. Every state is shown: opening, waiting for the browser, closed,
/// failed (with the browser as a second way when it exists).
///
/// [onSignedIn] runs once Google signed the student in on the spot; the router normally takes
/// over by itself. [busy] disables it while another method on the screen is working.
class GoogleSignInButton extends ConsumerStatefulWidget {
  const GoogleSignInButton({
    super.key,
    this.onSignedIn,
    this.busy = false,
    this.onBusyChanged,
  });

  final VoidCallback? onSignedIn;
  final bool busy;

  /// Tells the screen when Google is working, so it can hold its other keys.
  final ValueChanged<bool>? onBusyChanged;

  @override
  ConsumerState<GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends ConsumerState<GoogleSignInButton>
    with WidgetsBindingObserver {
  GooglePhase _phase = GooglePhase.idle;
  String? _problem;
  String? _note;
  bool _offerBrowser = false;
  StreamSubscription<OAuthReturn>? _returns;
  Timer? _noReturn;

  /// How long to wait after coming back from the browser for the callback link before saying
  /// the sign-in did not finish. The link normally lands before the app is even visible.
  static const double _glyphSize = 20;
  static const double _glyphGap = MmSpace.s12;

  static const _returnGrace = Duration(seconds: 3);

  /// How long to wait for the session once the callback link arrived. The exchange is a network
  /// call; past this the key works again rather than spinning with nothing to press.
  static const _exchangeWait = Duration(seconds: 45);

  AccountAccessGateway get _gateway => ref.read(accountAccessGatewayProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _returns = _gateway.oauthReturns().listen(
      _onReturn,
      onError: (Object _) {},
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _returns?.cancel();
    _noReturn?.cancel();
    super.dispose();
  }

  void _set(
    GooglePhase phase, {
    String? problem,
    String? note,
    bool? offerBrowser,
  }) {
    if (!mounted) return;
    final wasBusy = _phase != GooglePhase.idle;
    setState(() {
      _phase = phase;
      _problem = problem;
      _note = note;
      if (offerBrowser != null) _offerBrowser = offerBrowser;
    });
    final isBusy = phase != GooglePhase.idle;
    if (wasBusy != isBusy) widget.onBusyChanged?.call(isBusy);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || _phase != GooglePhase.inBrowser) {
      return;
    }
    _noReturn?.cancel();
    _noReturn = Timer(_returnGrace, () {
      if (_phase == GooglePhase.inBrowser) {
        _set(GooglePhase.idle, note: AccessCopy.browserNotFinished);
      }
    });
  }

  void _onReturn(OAuthReturn result) {
    _noReturn?.cancel();
    switch (result.kind) {
      case OAuthReturnKind.exchanging:
        // The link is here: no "did not finish" while the session is being set up.
        _set(GooglePhase.signingIn);
        _noReturn = Timer(_exchangeWait, () {
          if (_phase == GooglePhase.signingIn) {
            _set(GooglePhase.idle, note: AccessCopy.browserNotFinished);
          }
        });
      case OAuthReturnKind.signedIn:
        _set(GooglePhase.signingIn);
        widget.onSignedIn?.call();
      case OAuthReturnKind.cancelled:
        _set(GooglePhase.idle, note: AccessCopy.googleClosed);
      case OAuthReturnKind.failed:
        _set(
          GooglePhase.idle,
          problem: AccessCopy.problem(
            result.failure ?? AccessFailure.googleUnavailable,
          ),
        );
    }
  }

  Future<void> _continue() async {
    final browserAvailable = ref.read(accessMethodsProvider).googleBrowser;
    _set(GooglePhase.opening);
    try {
      final outcome = await _gateway.continueWithGoogle();
      switch (outcome) {
        case GoogleOutcome.signedIn:
          _set(GooglePhase.signingIn);
          widget.onSignedIn?.call();
        case GoogleOutcome.cancelled:
          // A misconfigured sheet also reports a cancel, so the browser is offered as a second way.
          _set(
            GooglePhase.idle,
            note: AccessCopy.googleClosed,
            offerBrowser: browserAvailable,
          );
        case GoogleOutcome.browserOpened:
          _set(GooglePhase.inBrowser);
      }
    } on AccessException catch (e) {
      _set(
        GooglePhase.idle,
        problem: AccessCopy.problem(e.failure),
        offerBrowser:
            browserAvailable && e.failure != AccessFailure.browserUnavailable,
      );
    } on Object {
      _set(
        GooglePhase.idle,
        problem: AccessCopy.problem(AccessFailure.unknown),
        offerBrowser: browserAvailable,
      );
    }
  }

  Future<void> _browser() async {
    _set(GooglePhase.opening, offerBrowser: false);
    try {
      await _gateway.continueWithGoogleInBrowser();
      _set(GooglePhase.inBrowser);
    } on AccessException catch (e) {
      _set(GooglePhase.idle, problem: AccessCopy.problem(e.failure));
    } on Object {
      _set(
        GooglePhase.idle,
        problem: AccessCopy.problem(AccessFailure.unknown),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final working =
        _phase == GooglePhase.opening || _phase == GooglePhase.signingIn;
    final label = switch (_phase) {
      GooglePhase.opening => AccessCopy.openingGoogle,
      GooglePhase.signingIn => AccessCopy.signingIn,
      _ => AccessCopy.continueWithGoogle,
    };

    final labelPainter = TextPainter(
      text: TextSpan(text: label, style: type.button),
      textDirection: TextDirection.ltr,
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final labelWidth = labelPainter.width;
    labelPainter.dispose();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          children: [
            KeyButton.secondary(
              label: label,
              loading: working,
              onPressed: widget.busy || _phase != GooglePhase.idle
                  ? null
                  : _continue,
            ),
            // Google's "G" sits just before the label, so the two read as one centred group
            // (the working spinner takes its place while Google opens).
            if (!working)
              Positioned.fill(
                child: ExcludeSemantics(
                  child: IgnorePointer(
                    child: Center(
                      child: Transform.translate(
                        offset: Offset(
                          -(labelWidth / 2 + _glyphGap + _glyphSize / 2),
                          0,
                        ),
                        child: Opacity(
                          opacity: widget.busy || _phase != GooglePhase.idle
                              ? 0.5
                              : 1,
                          child: const GoogleMark(size: _glyphSize),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (_phase == GooglePhase.inBrowser) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(
            liveRegion: true,
            child: Text(
              AccessCopy.finishInBrowser,
              style: type.small.copyWith(color: colors.ink2),
            ),
          ),
          const SizedBox(height: MmSpace.s4),
          Align(
            alignment: Alignment.centerLeft,
            // The quiet key carries 16 dp of inner padding; pull it back so its label lines up.
            child: Transform.translate(
              offset: const Offset(-MmSpace.s16, 0),
              child: KeyButton.quiet(
                label: AccessCopy.cancel,
                onPressed: () => _set(GooglePhase.idle),
              ),
            ),
          ),
        ],
        if (_problem != null) ...[
          const SizedBox(height: MmSpace.s12),
          AccessProblemLine(message: _problem!),
        ] else if (_note != null && _phase == GooglePhase.idle) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(
            liveRegion: true,
            child: Text(_note!, style: type.small.copyWith(color: colors.ink2)),
          ),
        ],
        if (_offerBrowser && _phase == GooglePhase.idle) ...[
          const SizedBox(height: MmSpace.s4),
          Align(
            alignment: Alignment.centerLeft,
            child: Transform.translate(
              offset: const Offset(-MmSpace.s16, 0),
              child: KeyButton.quiet(
                label: AccessCopy.useBrowserInstead,
                onPressed: widget.busy ? null : _browser,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Google's four-colour "G", drawn as a small vector (no asset): a ring of red, yellow, green
/// and blue arcs open to the upper right, with the blue bar across the middle.
class GoogleMark extends StatelessWidget {
  const GoogleMark({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: size,
    child: CustomPaint(painter: _GoogleMarkPainter()),
  );
}

class _GoogleMarkPainter extends CustomPainter {
  const _GoogleMarkPainter();

  static const _blue = Color(0xFF4285F4);
  static const _red = Color(0xFFEA4335);
  static const _yellow = Color(0xFFFBBC05);
  static const _green = Color(0xFF34A853);

  @override
  void paint(Canvas canvas, Size size) {
    final unit = size.width / 20;
    final stroke = 4 * unit;
    final centre = Offset(size.width / 2, size.height / 2);
    final ring = Rect.fromCircle(center: centre, radius: 8 * unit);
    double rad(double deg) => deg * math.pi / 180;

    void arc(Color color, double start, double sweep) {
      canvas.drawArc(
        ring,
        rad(start),
        rad(sweep),
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..color = color
          ..isAntiAlias = true,
      );
    }

    arc(_red, -130, 85);
    arc(_yellow, 130, 100);
    arc(_green, 45, 85);
    arc(_blue, 0, 45);
    canvas.drawRect(
      Rect.fromLTRB(
        centre.dx,
        centre.dy - 2 * unit,
        size.width,
        centre.dy + 2 * unit,
      ),
      Paint()
        ..color = _blue
        ..isAntiAlias = true,
    );
  }

  @override
  bool shouldRepaint(_GoogleMarkPainter oldDelegate) => false;
}
