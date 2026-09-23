# CrapChat

A real-time chat app built as my first proper JavaScript project. I wanted hands-on experience with WebSockets, so this is a small 1-on-1 messaging app built from scratch with no frameworks. It is just Node's built-in `http` module, the [`ws`](https://www.npmjs.com/package/ws) library, and vanilla HTML/CSS/JS on the frontend.

## Features

- Username / password accounts, with passwords hashed (scrypt + per-user salt) rather than stored in plain text
- Invite-key-gated registration
- Session-based login via HTTP-only cookies
- Real-time 1-on-1 messaging over WebSockets
- Online/offline presence for other users
- Persistent message history (SQLite)

## Tech stack

- **Backend:** Node.js — raw `http` module (no Express) + `ws` for the WebSocket side
- **Database:** SQLite, via Node's built-in `node:sqlite` module (no external driver needed)
- **Frontend:** Plain HTML, CSS, and JavaScript — no build step, no framework

## Prerequisites

- Node.js 22.x (a reasonably recent version — this project uses the built-in `node:sqlite` module)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set your own `ADMIN_AUTHKEY` — a shared secret required to register new accounts:
   ```bash
   cp .env.example .env
   ```
3. Start the server:
   ```bash
   npm start
   ```
   This listens on port `8090` by default, serving the HTTP API and the WebSocket connection from the same process. The SQLite database and its tables are created automatically on first run.

## Usage

- **Registering a new account:** there's no public sign-up flow yet — the `/register` endpoint requires the `ADMIN_AUTHKEY` from your `.env` file, so for now new accounts are created directly against the API:
  ```bash
  curl -X POST http://localhost:8090/register \
    -H "Content-Type: application/json" \
    -d '{"username":"alice","password":"yourpassword","authkey":"YOUR_ADMIN_AUTHKEY"}'
  ```
- **Logging in:** open `Client/index.html`, log in with a registered account, and you'll be redirected to the chat page.
- **Chatting:** the sidebar lists every registered user with their online/offline status — click one to open a conversation with them.

## Roadmap

This is still very much a work in progress. Planned next steps:

**Finishing what's there**
- Finish the logout flow
- Finish the self-service registration + invite-code system (registration currently only works via a direct API call, gated by the admin key)
- Wire up the "Forgot Username / Password?" link on the login page — it's already there, just not functional yet
- Show message timestamps in the chat UI — already sent over the WebSocket, just not rendered yet
- Populate the chat header with the other person's name, icon, and status when a conversation is opened — the UI slot for it already exists, it's just not filled in

**Real-time UX**
- Typing indicators ("alice is typing...")
- Read receipts
- Unread message badges in the sidebar
- Emoji reactions on messages

**Account & security**
- Basic rate limiting on login attempts
- "Log out of all devices" / view active sessions

**Content**
- Message editing/deleting
- Search (past messages and/or the user list)
- Profile pictures, and potentially sending images in chat
- Customizable chat backgrounds and message bubble colors, per conversation

**Branding & polish**
- Dark/light mode toggle (currently dark-only)
- A proper favicon and logo

**Bigger/stretch ideas**
- Browser notifications for new messages when the tab isn't focused
- Mobile-responsive layout (currently untested below desktop width)
- User status/bio text alongside online/offline
- Blocking users
- Group chats (currently 1-on-1 only)
- End-to-end message encryption (messages are currently stored as plaintext server-side)

## A note on deployment

I run this behind nginx (serving the static files and reverse-proxying the API/WebSocket traffic) with Cloudflare in front of it. That setup isn't covered here — this README only covers running the app itself.

## A note on AI assistance

I used Claude Code throughout this project, mainly as a learning aid — explaining concepts, reviewing my code, and catching bugs — rather than to write the application logic for me. It also helped speed up some structural/mechanical work (CSS layout, nginx config, refactoring sweeps) and suggested UI improvements. The core logic — auth, sessions, WebSocket handling, the chat functionality itself — I wrote myself.

Claude code was used to generate this README file also, as I am not great at those.

---

This is a learning project, built to understand the fundamentals rather than to be production-ready — expect rough edges.
