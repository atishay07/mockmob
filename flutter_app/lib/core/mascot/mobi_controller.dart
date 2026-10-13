import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'mobi_acts.dart';

/// A line Mobi is saying. [id] changes with every [MobiController.say], even for the same text.
@immutable
class MobiSpeech {
  const MobiSpeech(this.text, {this.live = false, required this.id});

  final String text;

  /// Announce the line to TalkBack when it appears (for a line that answers the student).
  final bool live;
  final int id;
}

/// How a line types in: about 30 ms a character, with small rests after punctuation.
abstract final class MobiTyping {
  static const double perChar = 0.03;
  static const double comma = 0.12;
  static const double stop = 0.22;

  /// The time (seconds) at which each character of [text] has appeared.
  static List<double> schedule(String text) {
    final out = <double>[];
    var t = 0.0;
    for (var i = 0; i < text.length; i++) {
      t += perChar;
      out.add(t);
      final ch = text[i];
      if (ch == ',' || ch == ';' || ch == ':') t += comma;
      if ((ch == '.' || ch == '!' || ch == '?') && i < text.length - 1) t += stop;
    }
    return out;
  }

  /// Seconds for all of [text] to type in.
  static double duration(String text) {
    final s = schedule(text);
    return s.isEmpty ? 0 : s.last;
  }
}

/// What a Mobi on screen can be asked to do. Implemented by the character's state.
abstract interface class MobiHost {
  void play(MobiAct act, {double? seconds});
  void lookAtGlobal(Offset? point);
  void pointAtGlobal(Offset point);
}

/// Drives one Mobi: [play] an act, [say] a line (Mobi talks while it types in), [lookAt] a point,
/// [pointAt] a point or widget. Commands sent before the Mobi is on screen wait for it.
class MobiController extends ChangeNotifier {
  MobiController();

  MobiHost? _host;
  MobiAct? _pendingAct;
  Offset? _pendingLook;
  bool _pendingLookSet = false;
  Offset? _pendingPoint;
  int _ids = 0;

  final ValueNotifier<MobiSpeech?> _speech = ValueNotifier(null);

  /// The line being said, or null.
  ValueListenable<MobiSpeech?> get speech => _speech;

  /// Plays [act]. Held acts (think, point, sleepy, rest, read, idle) last until the next one.
  void play(MobiAct act) {
    final host = _host;
    if (host == null) {
      _pendingAct = act;
    } else {
      host.play(act);
    }
  }

  /// Says [text] in the speech bubble; Mobi talks while it types in. [live] announces it.
  void say(String text, {bool live = false}) {
    _speech.value = MobiSpeech(text, live: live, id: ++_ids);
    _host?.play(MobiAct.talk, seconds: MobiTyping.duration(text) + 0.25);
  }

  /// Clears the speech bubble.
  void hush() => _speech.value = null;

  /// Looks toward [globalPoint] (screen coordinates), or back ahead when null.
  void lookAt(Offset? globalPoint) {
    final host = _host;
    if (host == null) {
      _pendingLook = globalPoint;
      _pendingLookSet = true;
    } else {
      host.lookAtGlobal(globalPoint);
    }
  }

  /// Points at [globalPoint] with the nearer arm (and looks at it). Held until the next act.
  void pointAt(Offset globalPoint) {
    final host = _host;
    if (host == null) {
      _pendingPoint = globalPoint;
    } else {
      host.pointAtGlobal(globalPoint);
    }
  }

  /// Points at the centre of the widget with [key], if it is laid out.
  void pointAtWidget(GlobalKey key) {
    final box = key.currentContext?.findRenderObject();
    if (box is RenderBox && box.hasSize) pointAt(box.localToGlobal(box.size.center(Offset.zero)));
  }

  /// Looks at the centre of the widget with [key], if it is laid out.
  void lookAtWidget(GlobalKey key) {
    final box = key.currentContext?.findRenderObject();
    if (box is RenderBox && box.hasSize) lookAt(box.localToGlobal(box.size.center(Offset.zero)));
  }

  /// Called by the character when it mounts.
  void attach(MobiHost host) {
    _host = host;
    final act = _pendingAct;
    if (act != null) host.play(act);
    if (_pendingLookSet) host.lookAtGlobal(_pendingLook);
    final point = _pendingPoint;
    if (point != null) host.pointAtGlobal(point);
    final line = _speech.value;
    if (line != null) host.play(MobiAct.talk, seconds: MobiTyping.duration(line.text) + 0.25);
    _pendingAct = null;
    _pendingLook = null;
    _pendingLookSet = false;
    _pendingPoint = null;
  }

  /// Called by the character when it unmounts.
  void detach(MobiHost host) {
    if (identical(_host, host)) _host = null;
  }

  @override
  void dispose() {
    _speech.dispose();
    super.dispose();
  }
}
