# Source before building on the owner's Windows machine:  source tool/android_env.sh
# Uses Android Studio's JDK and, when present, a build-only Java truststore that adds the
# antivirus TLS-scanning root (Windows already trusts it; the bundled JDK does not).
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="/c/Users/atish/AppData/Local/Android/Sdk"
TS="$HOME/.mockmob-build/truststore.jks"
if [ -f "$TS" ]; then
  export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=$(cygpath -w "$TS") -Djavax.net.ssl.trustStorePassword=changeit"
fi
export PATH="/c/flutter/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# Default to the emulator when more than one device is attached (the owner's phone uses -s explicitly).
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
