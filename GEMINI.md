# GEMINI.md

## Project Overview
**WA-OTP** is a Node.js-based API server that provides a RESTful interface for `whatsapp-web.js`. It is designed for WhatsApp automation, with specialized support for OTP delivery, media messaging, and channel (newsletter) management.

### Technologies
- **Runtime:** Node.js 18+
- **Framework:** Express.js 5.x
- **Core Library:** `whatsapp-web.js` (1.34.6+)
- **Security:** 
  - API Key authentication (Required via `x-api-key` header or `api_key` query param).
  - CORS enabled for all origins.
- **Persistence:** `LocalAuth` with configurable `SESSION_ID`.
- **Communication:** Axios-based webhooks for real-time events.

### Architecture
- `index.js`: Monolithic server handling auth, client lifecycle, and all API routes.
- **Key Middleware:**
  - `authenticate`: Validates the API key.
  - `checkReady`: Ensures the WhatsApp client is connected before processing requests.

## Building and Running
### Prerequisites
- Node.js 18+
- Chrome/Chromium installed for Puppeteer.

### Setup
1. `npm install`
2. `cp .env.example .env` (Set `API_KEY`, `SESSION_ID`, and `PORT`).
3. `node index.js`
4. Scan the QR code in the terminal.

### Session Management
- **Persistence:** Session data is stored in `.wwebjs_auth/session-[SESSION_ID]`.
- **Reset:** Use the `/reset-session` endpoint to log out and clear local state if errors occur.

## API Endpoints
- **Status:** `GET /status` - Check connectivity.
- **OTP:** `POST /send-otp` - Send formatted verification codes.
- **Media:** `POST /send-media` - Send files via URL.
- **Newsletter (⚠️ CURRENTLY NOT WORKING):** 
  - `POST /send-newsletter` - Send to channels (Currently returns `reading property add` error).
  - `GET /admin-newsletters` - List channels where the client is an ADMIN, OWNER, or CREATOR (Currently inconsistent).
- **Webhook:** `POST /webhook` - Register a callback URL.
- **Generic:** `POST /call` - Execute any `whatsapp-web.js` method dynamically.

## Development Conventions
- **Compatibility:** Use `webVersionCache` in `index.js` to pin a stable WhatsApp Web version if internal library errors occur.
- **Serialization:** Always use the `serialize()` helper to strip circular references from WhatsApp objects before sending JSON responses.
- **Newsletter Handling:** When sending to channels, always ensure `sendSeen: false` in options to avoid internal browser crashes.
- **Error Handling:** Provide descriptive error messages and suggestions (e.g., session reset) for common Puppeteer/WhatsApp Web failures.
