# R8 keep rules for the release build. The Flutter Gradle plugin turns on R8 shrinking and
# resource shrinking for release and adds Flutter's own rules plus this file.
# Most plugins ship consumer rules; the ones below are belt and braces for the plugins that use
# reflection, JSON/Gson or protobuf, so a release build behaves like a debug build.

# Keep generic signatures and annotations (Gson TypeToken, Kotlin metadata, Tink/protobuf).
-keepattributes Signature,InnerClasses,EnclosingMethod,*Annotation*,RuntimeVisibleAnnotations

# flutter_local_notifications: scheduled reminders are stored as JSON with Gson and read back
# by a broadcast receiver after reboot, so the model classes and TypeToken subclasses must keep
# their names and fields.
-keep class com.dexterous.flutterlocalnotifications.** { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-keep class com.google.gson.reflect.TypeToken { *; }

# workmanager: the background worker and its helpers are created by WorkManager by class name.
-keep class dev.fluttercommunity.workmanager.** { *; }
-keep class * extends androidx.work.ListenableWorker { public <init>(android.content.Context, androidx.work.WorkerParameters); }

# home_widget: widget providers, receivers and the background callback.
-keep class es.antonborri.home_widget.** { *; }

# google_sign_in (Credential Manager): the Play services credential provider is loaded by reflection.
-keep class androidx.credentials.playservices.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }

# flutter_secure_storage uses Tink; its protobuf generated messages must not be stripped.
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn javax.annotation.concurrent.**
-dontwarn com.google.api.client.http.**
-dontwarn org.joda.time.**

# MockMob's own platform channels (MainActivity, NotificationsPackage, PlatformPackage).
-keep class in.mockmob.app.** { *; }

# Flutter deferred components reference Play Core, which this app does not ship.
-dontwarn com.google.android.play.core.**
