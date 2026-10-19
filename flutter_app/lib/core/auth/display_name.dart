/// The account's name as it may be shown or said to the student, or null.
///
/// A code sign-up stores the email's own local part ("g16-fresh-1019a") as the name until the
/// student gives one, and a 17-year-old reads it as "That's not my name. Did it break?" (fresh-account
/// walk, 19 Oct). So a name that is the email's local part (exactly, or in lower case as the server
/// stores it), or the email itself, is not shown: the screen greets without a name and asks for one
/// where the name would stand.
///
/// Every real name shows, with dots, hyphens, apostrophes and spaces ("A. Jain", "Mary-Ann",
/// "Atishay Jain"), and so does a name the student typed that only looks like the prefix in another
/// case ("Atishay" for atishay@...): the server never stores a capital the email did not have (I11,
/// 20 Oct). A name with a digit, an underscore or an @ is a handle no person is called
/// ("app-e2e-student", "asha_v") and stays hidden.
/// Today's greeting rule (TodayCopy.isHandleName) is this one.
String? shownName(String? name, {String? email}) {
  final trimmed = name?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  if (RegExp(r'[0-9_@]').hasMatch(trimmed)) return null;
  final local = email?.trim().split('@').first ?? '';
  if (local.isNotEmpty && (trimmed == local || trimmed == local.toLowerCase())) return null;
  return trimmed;
}

/// The first word of [shownName], for a greeting ("Good evening, Atishay"), or null. The whole name
/// is checked against the email first, so "atishay jain" for atishay@... still greets "atishay".
String? shownFirstName(String? name, {String? email}) => shownName(name, email: email)?.split(RegExp(r'\s+')).first;
