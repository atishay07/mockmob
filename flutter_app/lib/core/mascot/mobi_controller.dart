import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'mobi_acts.dart';
import 'mobi_ration.dart';

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

/// The attention half of a Mobi on screen: short looks that come back by themselves. A separate
/// interface so existing [MobiHost] implementations keep compiling.
abstract interface class MobiAttentionHost {
  void glanceAtGlobal(Offset point, double seconds);
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
  (Offset, double)? _pendingGlance;
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

  /// Says [text] only if [screen] has not spoken yet in this app run (Mobi speaks at most once
  /// per screen per run). Returns whether he said it.
  bool sayOnce(String screen, String text, {bool live = false}) {
    if (!MobiRation.speakOnce(screen)) return false;
    say(text, live: live);
    return true;
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

  /// Glances at [globalPoint] for [hold], then looks back: new content arriving, a tap, the next
  /// step. Lighter than [lookAt], which holds until changed.
  void glance(Offset globalPoint, {Duration hold = const Duration(milliseconds: 1100)}) {
    final seconds = hold.inMicroseconds / 1e6;
    final host = _host;
    if (host == null) {
      _pendingGlance = (globalPoint, seconds);
    } else if (host is MobiAttentionHost) {
      (host as MobiAttentionHost).glanceAtGlobal(globalPoint, seconds);
    }
  }

  /// Glances at the centre of the widget with [key], if it is laid out.
  void glanceAtWidget(GlobalKey key, {Duration hold = const Duration(milliseconds: 1100)}) {
    final box = key.currentContext?.findRenderObject();
    if (box is RenderBox && box.hasSize) glance(box.localToGlobal(box.size.center(Offset.zero)), hold: hold);
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
    final glance = _pendingGlance;
    if (glance != null && host is MobiAttentionHost) (host as MobiAttentionHost).glanceAtGlobal(glance.$1, glance.$2);
    _pendingGlance = null;
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
