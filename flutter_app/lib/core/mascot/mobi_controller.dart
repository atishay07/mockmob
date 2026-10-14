import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'mobi_acts.dart';
import 'mobi_mood.dart';
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

/// The emotional half of a Mobi on screen (15 Oct): a mood, reactions that know the
/// Celebrations setting and reduced motion, and eyes that follow a finger. A separate interface
/// so existing [MobiHost] implementations keep compiling.
abstract interface class MobiLifeHost {
  void setMood(MobiMood mood);

  /// Plays a reaction: calmed or skipped under the Celebrations setting, a still pose with no
  /// travel under reduced motion. False when nothing played.
  bool react(MobiAct act);

  /// The eyes follow [globalPoint]; null lets them go back ahead.
  void followGlobal(Offset? globalPoint);
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
  MobiMood _mood = MobiMood.calm;
  MobiAct? _pendingReact;
  (MobiAct, double)? _pendingFor;

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

  /// Plays [act] for [length]: the walk for the length of a trip, a held beat for longer. Acts
  /// that play once keep their own timing unless given one.
  void playFor(MobiAct act, Duration length) {
    final seconds = length.inMicroseconds / 1e6;
    final host = _host;
    if (host == null) {
      _pendingFor = (act, seconds);
    } else {
      host.play(act, seconds: seconds);
    }
  }

  /// The face under every act (see [MobiMood]); it blends over 300 ms and stays until changed.
  MobiMood get mood => _mood;

  /// Sets the face under every act. It persists across acts, screens rebuilding and the Mobi
  /// leaving and coming back onto the screen with this controller.
  void setMood(MobiMood mood) {
    _mood = mood;
    final host = _host;
    if (host is MobiLifeHost) (host as MobiLifeHost).setMood(mood);
  }

  /// Plays [act] as a reaction to something the student did or the server said. Feature screens
  /// call this rather than [play]:
  ///
  /// - with a [key], at most one reaction per key in [gap] (a save every second nods once);
  /// - a celebration (cheer, celebrate, proud) is calmed to a nod under Quiet and skipped under
  ///   Off (the words still carry the moment);
  /// - under reduced motion Mobi shows the act's still pose with no travel, then his stance.
  ///
  /// Returns whether Mobi reacted. Before the Mobi is on screen the reaction waits for it.
  bool react(MobiAct act, {String? key, Duration gap = MobiRation.glanceGap}) {
    if (key != null && !MobiRation.reactNow(key, gap: gap)) return false;
    final host = _host;
    if (host == null) {
      _pendingReact = act;
      return true;
    }
    if (host is MobiLifeHost) return (host as MobiLifeHost).react(act);
    host.play(act);
    return true;
  }

  /// The eyes follow [globalPoint] (a finger, a pointer), clamped to where eyes can look; after
  /// 1.2 s with no new point they drift back ahead. Null lets go at once.
  void follow(Offset? globalPoint) {
    final host = _host;
    if (host is MobiLifeHost) (host as MobiLifeHost).followGlobal(globalPoint);
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
    if (host is MobiLifeHost && _mood != MobiMood.calm) (host as MobiLifeHost).setMood(_mood);
    final act = _pendingAct;
    if (act != null) host.play(act);
    if (_pendingLookSet) host.lookAtGlobal(_pendingLook);
    final point = _pendingPoint;
    if (point != null) host.pointAtGlobal(point);
    final line = _speech.value;
    if (line != null) host.play(MobiAct.talk, seconds: MobiTyping.duration(line.text) + 0.25);
    final glance = _pendingGlance;
    if (glance != null && host is MobiAttentionHost) (host as MobiAttentionHost).glanceAtGlobal(glance.$1, glance.$2);
    final forAct = _pendingFor;
    if (forAct != null) host.play(forAct.$1, seconds: forAct.$2);
    final reaction = _pendingReact;
    if (reaction != null) {
      if (host is MobiLifeHost) {
        (host as MobiLifeHost).react(reaction);
      } else {
        host.play(reaction);
      }
    }
    _pendingFor = null;
    _pendingReact = null;
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
