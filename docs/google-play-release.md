# Tagnivra Android release checklist

This repository currently packages the existing web interface inside an Android WebView. It does not yet use a Trusted Web Activity, and the Android app is not published to Google Play just because an APK is built.

## 1. Create a persistent upload key

Create an upload keystore locally using Android Studio's key generation tools or `keytool`. Keep the keystore and passwords in a safe, private backup. Never commit the keystore to Git.

For a command-line keystore, run this on a trusted computer and choose your own strong passwords:

```bash
keytool -genkeypair -v -keystore tagnivra-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias tagnivra
```

Convert the file to a single-line base64 value:

- macOS/Linux: `base64 -w 0 tagnivra-upload.jks`
- PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("tagnivra-upload.jks"))`

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `ANDROID_KEYSTORE_BASE64`: the base64 output
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: alias (for the example above, `tagnivra`)
- `ANDROID_KEY_PASSWORD`: key password

The workflow then builds a signed `app-release.aab`. If these secrets are absent, it builds only a debug APK for testing.

## 2. Run the Android build

Open the repository's **Actions** tab, select **Build Tagnivra Android APK and Play Store bundle**, and choose **Run workflow**. Download `tagnivra-android-builds` from the successful run's artifacts. Artifacts expire after 14 days, so save the files securely.

The debug APK is for device testing. Upload the signed `.aab` to Play Console, not the debug APK.

## 3. Before submitting to Google Play

- Confirm the app name, launcher icon, screenshots, short description, and full description.
- Test on real Android devices and check navigation, back button, keyboard, copy/share, storage, network errors, and accessibility.
- Verify that every feature advertised in the store listing works. The Android wrapper loads the checked-in `index.html`; web-hosted AI/API features must be configured and reachable from the app if they are expected to work.
- Publish a privacy policy URL and complete Play Console's Data safety form accurately for the app's actual data practices.
- Complete the app-content declarations, content rating, target audience, and ads declaration as applicable.
- Create the app in Play Console, configure app signing, upload the signed AAB, and use internal testing before requesting production review.
- Confirm current account verification, testing, and release requirements in Play Console. Build success does not guarantee store approval.

## Current technical settings

- Application ID: `com.tagnivra.app`
- Version: `1.0.0` (version code `1`)
- Minimum Android API: 23
- Target Android API: 36
- Output for Play Console: signed Android App Bundle (`.aab`)

Changing the application ID after publication creates a different app. Keep the upload keystore and application ID consistent for future updates.
