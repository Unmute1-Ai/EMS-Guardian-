plugins { id("com.android.application") }
android {
  namespace = "com.unmute1ai.fieldphrases"
  compileSdk = 35
  defaultConfig { applicationId = "com.unmute1ai.fieldphrases"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "0.1.0" }
  buildTypes { getByName("release") { isMinifyEnabled = false; isDebuggable = false; signingConfig = signingConfigs.getByName("debug") } }
  androidResources { noCompress += listOf("mp3", "json") }
  compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
