# WA-OTP

A WhatsApp-Web.js based API server for WhatsApp automation and OTP delivery.

## Features
- Full access to `whatsapp-web.js` functions via generic `/call` endpoint.
- Specialized endpoints for common tasks (send message, send media, send OTP).
- Webhook support for real-time events.
- Persistent authentication using `LocalAuth`.

## Configuration
The app uses environment variables defined in `.env`. You can copy `.env.example` to get started:
```bash
cp .env.example .env
```

### Environment Variables
- `PORT`: Port the server will listen on (default: 3050).
- `API_KEY`: Secret key required to access the API.
- `SESSION_ID`: Identifier for the WhatsApp session (allows multiple sessions on one machine).
- `WEBHOOK_URL`: Optional URL to receive real-time events.

## Authentication
All API requests must include the API key. You can provide it in two ways:
1.  **Header:** `x-api-key: your_secret_key`
2.  **Query Parameter:** `?api_key=your_secret_key`

## Persistence
The app uses `LocalAuth` with the `SESSION_ID` provided in `.env`. This ensures that once you scan the QR code, the session remains active even after restarting the server. Session data is stored in the `.wwebjs_auth` directory.

## Usage Examples

Replace `YOUR_API_KEY` with the value from your `.env` file and `[NUMBER]` with the destination phone number (e.g., `1234567890@c.us`).

### 1. Check Status
```bash
curl -X GET http://localhost:3050/status \
  -H "x-api-key: YOUR_API_KEY"
```

### 2. Set Webhook
```bash
curl -X POST http://localhost:3050/webhook \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-server.com/webhook"}'
```

### 3. Send Message
```bash
curl -X POST http://localhost:3050/send-message \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "[NUMBER]@c.us",
    "content": "Hello from WA-OTP!"
  }'
```

### 4. Send Media
```bash
curl -X POST http://localhost:3050/send-media \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "[NUMBER]@c.us",
    "url": "https://raw.githubusercontent.com/pedroslopez/whatsapp-web.js/master/screenshot.png",
    "caption": "Check out this screenshot!"
  }'
```

### 5. Send OTP
```bash
curl -X POST http://localhost:3050/send-otp \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "[NUMBER]",
    "otp": "123456",
    "template": "Your verification code is: {{otp}}"
  }'
```

### 6. Send Newsletter/Channel Message
```bash
curl -X POST http://localhost:3050/send-newsletter \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "1234567890123456@newsletter",
    "content": "Hello channel subscribers!"
  }'
```

### 7. List Admin Newsletters
```bash
curl -X GET http://localhost:3050/admin-newsletters \
  -H "x-api-key: YOUR_API_KEY"
```

### 8. Reset Session
Use this if you encounter persistent "reading property add" errors. It will log you out and require a fresh QR scan.
```bash
curl -X POST http://localhost:3050/reset-session \
  -H "x-api-key: YOUR_API_KEY"
```

### 9. Generic Call (Get Contact)
```bash
curl -X POST http://localhost:3050/call \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "client",
    "method": "getContactById",
    "args": ["[NUMBER]@c.us"]
  }'
```

### 7. Generic Call (Archive Chat)
```bash
curl -X POST http://localhost:3050/call \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "chat",
    "id": "[NUMBER]@c.us",
    "method": "archive"
  }'
```

## API Endpoints

### 1. Generic Call
Allows calling any method on the `client`, `chat`, or `contact` objects.
- **URL:** `/call`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "type": "client" | "chat" | "contact",
    "id": "optional id for chat/contact",
    "method": "methodName",
    "args": ["array", "of", "arguments"]
  }
  ```

### 2. Send Message
- **URL:** `/send-message`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "chatId": "number@c.us",
    "content": "Hello world"
  }
  ```

### 3. Send Media
- **URL:** `/send-media`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "chatId": "number@c.us",
    "url": "https://example.com/image.png",
    "caption": "Check this out!"
  }
  ```

### 4. Send OTP
- **URL:** `/send-otp`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "number": "number",
    "otp": "123456",
    "template": "Your login code is {{otp}}"
  }
  ```

### 5. Set Webhook
- **URL:** `/webhook`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "url": "https://your-webhook-endpoint.com/callback"
  }
  ```

## Requirements
- Node.js 18+
- Chrome/Chromium installed (for Puppeteer)
