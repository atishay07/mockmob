/// The account's name as it may be shown or said to the student, or null.
///
/// A fresh account's name is the email's own local part ("g16-fresh-1019a") until the student gives
/// one, and a 17-year-old reads it as "That's not my name. Did it break?" (fresh-account walk, 19
/// Oct). Such a name, or any handle ("app-e2e-student", "asha_v", "asha.v", "asha07"), is never shown
/// or used to greet: the screen greets without a name and asks for one where the name would stand.
/// The rule is Today's greeting rule (TodayCopy.isHandleName), in one place for the other screens.
String? shownName(String? name, {String? email}) {
  final trimmed = name?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  if (RegExp(r'[0-9_.\-@]').hasMatch(trimmed)) return null;
  final local = email?.split('@').first.toLowerCase();
  if (local != null && local.isNotEmpty && trimmed.toLowerCase() == local) return null;
  return trimmed;
}

/// The first word of [shownName], for a greeting ("Hi Asha."), or null.
String? shownFirstName(String? name, {String? email}) => shownName(name, email: email)?.split(RegExp(r'\s+')).first;
