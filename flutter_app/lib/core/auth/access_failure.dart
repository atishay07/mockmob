import 'package:supabase_flutter/supabase_flutter.dart'
    show AuthException, AuthRetryableFetchException, AuthWeakPasswordException;

/// Why a sign-in method (password, Google, phone, setting a password) failed, in terms the
/// account-access screens have copy for. Separate from [AuthFailure], which the email-code
/// screens switch over exhaustively.
enum AccessFailure {
  /// No connection. Nothing was changed.
  offline,

  /// Supabase is briefly unavailable (5xx). Nothing was changed.
  unavailable,

  /// Too many tries; wait a minute.
  rateLimited,

  /// The email and password do not match an account with a password.
  wrongPassword,

  /// The new password is too short or too common.
  weakPassword,

  /// The new password is the current one.
  samePassword,

  /// Setting a password needs a recent sign-in.
  reauthRequired,

  invalidEmail,
  invalidCode,
  invalidPhone,

  /// Phone sign-in only works for a phone already added to an account.
  phoneNotLinked,

  /// The phone number belongs to another account.
  phoneTaken,

  /// The method is not set up in this build or on the server.
  notConfigured,

  /// Google said no or the account sheet could not be used.
  googleUnavailable,

  /// No browser could be opened.
  browserUnavailable,

  /// The action needs a signed-in student.
  signedOut,

  unknown,
}

class AccessException implements Exception {
  const AccessException(this.failure);

  final AccessFailure failure;

  @override
  String toString() => 'AccessException($failure)';
}

/// Maps a Supabase auth error to an [AccessFailure]. Messages are never shown or logged:
/// only the code and status are read.
AccessFailure accessFailureFrom(Object error) {
  if (error is AccessException) return error.failure;
  if (error is AuthRetryableFetchException) {
    final status = int.tryParse(error.statusCode ?? '');
    return status != null && status >= 500 ? AccessFailure.unavailable : AccessFailure.offline;
  }
  if (error is AuthWeakPasswordException) return AccessFailure.weakPassword;
  if (error is AuthException) {
    final code = error.code;
    final status = error.statusCode;
    if (status == '429' || (code != null && code.startsWith('over_') && code.endsWith('rate_limit'))) {
      return AccessFailure.rateLimited;
    }
    switch (code) {
      case 'invalid_credentials':
        return AccessFailure.wrongPassword;
      case 'weak_password':
        return AccessFailure.weakPassword;
      case 'same_password':
        return AccessFailure.samePassword;
      case 'reauthentication_needed':
      case 'reauthentication_not_valid':
        return AccessFailure.reauthRequired;
      case 'otp_expired':
        return AccessFailure.invalidCode;
      case 'email_address_invalid':
      case 'email_address_not_authorized':
        return AccessFailure.invalidEmail;
      case 'validation_failed':
        return AccessFailure.invalidPhone;
      case 'otp_disabled':
      case 'signup_disabled':
      case 'user_not_found':
        return AccessFailure.phoneNotLinked;
      case 'phone_exists':
        return AccessFailure.phoneTaken;
      case 'phone_provider_disabled':
      case 'sms_send_failed':
      case 'provider_disabled':
      case 'email_provider_disabled':
        return AccessFailure.notConfigured;
      case 'session_not_found':
      case 'no_authorization':
      case 'bad_jwt':
        return AccessFailure.signedOut;
    }
    if (status != null && (int.tryParse(status) ?? 0) >= 500) return AccessFailure.unavailable;
  }
  return AccessFailure.unknown;
}
