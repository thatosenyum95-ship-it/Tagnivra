# Tagnivra

Tagnivra generates topic-relevant keywords and hashtags for social media. The repository includes the web app and an Android WebView packaging workflow.

## Android APK and Google Play preparation

The workflow `.github/workflows/build-apk.yml` builds a debug APK on pushes to `main` that change the web app, and when manually run from GitHub Actions. The APK is uploaded as a workflow artifact for 14 days.

To build a **signed Android App Bundle (.aab)** for Google Play, configure these repository Actions secrets first:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded upload keystore file
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: upload key alias
- `ANDROID_KEY_PASSWORD`: upload key password

Keep the keystore and passwords private. Do not commit them to this repository. Full setup, testing, and Play Console checklist: [docs/google-play-release.md](docs/google-play-release.md).

The Android build targets API 36, the current requirement for new Google Play apps from 31 August 2026. A successful build does not itself publish the app; the signed AAB must still be uploaded and reviewed in Play Console.

## AI provider order

1. Gemini API (gemini-2.5-flash) is the primary provider.
2. OpenAI API (gpt-4o-mini) is used if Gemini is not configured or fails.
3. An optional self-hosted endpoint can be used if both APIs fail.

## Configure Cloudflare Worker secrets

Open the Cloudflare dashboard, choose Workers & Pages > tagnivra > Settings > Variables and Secrets.

Add these as Secrets (not plain-text variables):

- GEMINI_API_KEY: key from https://aistudio.google.com/apikey
- OPENAI_API_KEY: key from https://platform.openai.com/api-keys

You may configure either provider or both. To use the intended primary/fallback order, configure both. Do not put either key in index.html, the Android APK, or a public GitHub file.

Optional self-hosted fallback:
- SELF_HOSTED_AI_URL: HTTPS base URL of the self-hosted API
- SELF_HOSTED_AI_TOKEN: bearer token matching the server configuration

## Test

After deploying the updated Worker and adding secrets, open:

- https://tagnivra.thatosenyum95.workers.dev/health

The response reports whether the Gemini and OpenAI secrets are configured; it never returns their values.

Send a POST request to /generate with JSON such as:

```json
{
  "topic": "resep nasi goreng sederhana",
  "platform": "YouTube",
  "language": "id",
  "style": "Tutorial"
}
```

A successful response contains hashtags, keywords, provider, and model.

## Important

Committing code to GitHub does not deploy the Worker automatically unless it has a deployment pipeline. After updating the repository, deploy the Worker code in Cloudflare and add secrets there. API usage can have quotas and charges depending on the provider/account.
