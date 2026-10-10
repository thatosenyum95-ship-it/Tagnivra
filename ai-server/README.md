# Tagnivra Self-Hosted AI (first prototype)

This service runs an open-weight model through Ollama. It does not call the OpenAI API or Gemini API.

## Requirements

- A Linux cloud server with Docker Compose.
- For a first test, use a small quantized model such as `qwen2.5:3b`; expect slow responses on CPU-only servers. A GPU server is recommended for better latency and multiple users.
- Keep the Ollama port private. Do not expose port 11434 to the public internet.

## Start

1. Copy `.env.example` to `.env` and replace `TAGNIVRA_API_TOKEN` with a long random secret.
2. Start Ollama: `docker compose up -d ollama`
3. Download the model: `docker compose exec ollama ollama pull qwen2.5:3b`
4. Build/start the API: `docker compose up -d --build api`
5. Check logs: `docker compose logs -f api`

The API listens on `127.0.0.1:8000` on the host. This is intentionally private. For production, place a TLS-enabled reverse proxy or authenticated tunnel in front of it. Set a strong token and configure the frontend/Worker to send it securely; never put a permanent secret in browser JavaScript.

## Endpoints

- `GET /health`
- `POST /generate` with JSON such as:

```json
{
  "topic": "Cara membuat bakso kenyal di rumah",
  "platform": "youtube",
  "language": "id",
  "style": "tutorial"
}
```

Successful responses contain `hashtags`, `keywords`, `note`, and `model`.

## Important

This is a starter implementation, not yet deployed or connected to the public Tagnivra app. The model is downloaded when you run the Ollama pull command. Check the selected model's license and the cloud server provider's acceptable-use terms before public launch.
