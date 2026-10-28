# ChatNova — Production Node.js, Express & Socket.io Backend

> **Tagline:** Your Privacy • Our Priority  
> Production-ready, secure offshore backend with MongoDB (Mongoose), JWT, and Socket.io real-time engine.

---

## 🚀 Quick Start (Local & Cloud)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your MongoDB connection string (e.g. MongoDB Atlas or local MongoDB) and secrets:
```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/chatnova?retryWrites=true&w=majority
JWT_SECRET=chatnova_super_secret_jwt_key_2026_post_quantum
MASTER_ADMIN_SECRET=NovaMaster@2026
MASTER_ADMIN_2FA_TOKEN=774921
CORS_ORIGIN=*
```

### 3. Run the Server
```bash
# Development (with nodemon auto-restart)
npm run dev

# Production
npm start
```

---

## 📡 REST API Reference

### 1. Authentication (`/api/auth`)

#### `POST /api/auth/register`
Creates a decentralized cryptographic identity without phone numbers.
- **Request Body:**
  ```json
  {
    "customId": "@alex_sec",
    "displayName": "Alex Mercer",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": {
      "id": "664fa1...",
      "customId": "@alex_sec",
      "displayName": "Alex Mercer",
      "publicKeyFingerprint": "8492 1029 4820 1934 5021 9923"
    }
  }
  ```

#### `POST /api/auth/login`
Authenticates a user identity and issues a cryptographic JWT token.
- **Request Body:**
  ```json
  {
    "customId": "@alex_sec",
    "password": "SecurePassword123!"
  }
  ```

#### `GET /api/auth/me`
Returns the current authenticated user's profile.
- **Headers:** `Authorization: Bearer <token>`

---

### 2. Master Admin Protected APIs (`/api/admin`)
*Requires both `x-master-admin-secret` and `x-master-2fa-token` headers.*

#### `GET /api/admin/users`
Lists all registered users with search, pagination, and ban status.
- **Headers:**
  - `x-master-admin-secret: NovaMaster@2026`
  - `x-master-2fa-token: 774921`
- **Query Params:** `?search=@alex&status=active&page=1&limit=50`

#### `PUT /api/admin/users/:id/ban`
Bans or unbans a user identity and forcibly disconnects their active socket session.
- **Headers:** `x-master-admin-secret`, `x-master-2fa-token`
- **Request Body:**
  ```json
  {
    "isBanned": true,
    "reason": "Suspicious cryptographic probe detected"
  }
  ```

#### `GET /api/admin/stats`
Returns system KPIs (active tunnels, total users, Zurich ping, message counts).

#### `GET /api/admin/audit-logs`
Returns the tamper-proof security audit trail.

#### `POST /api/admin/broadcast`
Dispatches a signed administrative broadcast to all live Socket.io clients.
- **Request Body:**
  ```json
  {
    "message": "Enclave maintenance scheduled at 00:00 UTC."
  }
  ```

---

## ⚡ Socket.io Real-Time Protocol Specification

Connect client to `ws://your-server:5000` (or `wss://...`).

### Client $\to$ Server Events

| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `auth:init` | `{ userId, customId }` | Registers socket session, sets status to `online`, and triggers delivery of pending messages. |
| `chat:send_message` | `{ chatId, recipientId, senderId, content, type, voice, media }` | Sends encrypted text, voice note, or media. |
| `chat:mark_read` | `{ chatId, messageIds, readerId }` | Marks messages as read and emits double blue tick to sender. |
| `chat:typing` | `{ chatId, recipientId, isTyping, senderCustomId }` | Emits typing state indicator. |

### Server $\to$ Client Events

| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `chat:message_acknowledged` | `{ message, status: 'sent' }` | Confirms message saved in MongoDB (**Single Tick**). |
| `chat:new_message` | `{ message }` | Delivers new incoming message to the recipient socket. |
| `chat:message_status` | `{ messageId, chatId, status: 'delivered' }` | Notifies sender that recipient received the message (**Double Grey Tick**). |
| `chat:read_receipt` | `{ chatId, readerId, status: 'read' }` | Notifies sender that recipient opened the chat (**Double Blue Tick**). |
| `user:presence_update` | `{ userId, customId, status, lastSeen }` | Broadcasts online/offline status changes. |
| `admin:broadcast` | `{ message, timestamp }` | Global alert banner from Master Admin. |
| `auth:force_disconnect` | `{ message }` | Forcibly terminates session if user was banned by Master Admin. |

---

## ☁️ Deployment Guide

### Option A: Deploy with Docker
```bash
docker build -t chatnova-backend .
docker run -d -p 5000:5000 --env-file .env --name chatnova chatnova-backend
```

### Option B: Deploy on VPS with PM2
```bash
sudo npm install -g pm2
pm2 start src/server.js --name "chatnova-backend"
pm2 save
pm2 startup
```

### Option C: Deploy on Railway / Render
1. Push this folder to a GitHub repository.
2. Select **Web Service** on Railway or Render.
3. Set Build Command: `npm install`
4. Set Start Command: `npm start`
5. Configure Environment Variables in the service settings (`MONGO_URI`, `JWT_SECRET`, etc.).
