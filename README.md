# CrapChat

A real-time chat app built as my first proper JavaScript project. I wanted hands-on experience with WebSockets, so this is a small 1-on-1 messaging app built from scratch with no frameworks. It is just Node's built-in `http` module, the [`ws`](https://www.npmjs.com/package/ws) library, and vanilla HTML/CSS/JS on the frontend.

## Features

- Username / password accounts, with passwords hashed (scrypt + per-user salt) rather than stored in plain text
- Invite-key-gated registration
- Session-based login via HTTP-only cookies, with logout from the user menu
- Logged-in users skip the login page, and the chat page redirects to login if you're not logged in
- Real-time 1-on-1 messaging over WebSockets
- Online/offline presence for other users, shown in the sidebar and updated live in the chat header
- Chat header showing the other person's name, avatar initial, and status
- Persistent message history (SQLite) — the latest 100 messages load when you open a conversation
- Message timestamps, shown in the reader's local time, with day dividers ("Today", "Yesterday", dates) between days
- WhatsApp-style ticks on your messages: grey once the server has it, fading to blue when it's been read
- Read tracking — messages count as read once the chat has been open in a focused tab for 5 seconds, or as soon as you reply
- A "New messages" divider above the first unread message, which the chat opens at
- Smart auto-scroll: the chat follows new messages if you're at the bottom, but leaves you alone if you've scrolled up to read, with a button to jump back to the latest
- A heartbeat that keeps the connection alive through proxies and drops clients that have gone away, so online/offline status stays accurate
- Server-side validation, so malformed requests and WebSocket messages are rejected instead of crashing the server
- Static files served by Node with a path traversal guard, so requests can't reach anything outside the `Client` folder
- Styled scrollbars and light animations (which turn off if your system is set to reduce motion)

## Tech stack

- **Backend:** Node.js — raw `http` module (no Express) serving the pages, API, and static files, + `ws` for the WebSocket side
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
   This listens on port `8090` by default, serving the pages, the HTTP API and the WebSocket connection from the same process. The SQLite database and its tables are created automatically on first run.

## Usage

- **Registering a new account:** there's no public sign-up flow yet — the `/register` endpoint requires the `ADMIN_AUTHKEY` from your `.env` file, so for now new accounts are created directly against the API:
  ```bash
  curl -X POST http://localhost:8090/register \
    -H "Content-Type: application/json" \
    -d '{"username":"alice","password":"yourpassword","authkey":"YOUR_ADMIN_AUTHKEY"}'
  ```
- **Logging in:** go to `http://localhost:8090`, log in with a registered account, and you'll be redirected to the chat page. If you're already logged in, you'll skip straight to the chat.
- **Chatting:** the sidebar lists every registered user with their online/offline status — click one to open a conversation with them. Your previous messages load automatically, opening at the first unread message if there is one.
- **Logging out:** click your name at the top right and choose **Log out**.

## Roadmap

This is still very much a work in progress. Planned next steps:

**Finishing what's there**
- Reconnect automatically when the WebSocket drops — the heartbeat keeps idle connections alive, but after a real disconnect (server restart, network change) the page still needs a refresh
- Support being logged in on more than one tab/device at once — currently only the most recently opened one gets live messages and read updates
- Finish the self-service registration + invite-code system (registration currently only works via a direct API call, gated by the admin key)
- Wire up the "Forgot Username / Password?" link on the login page — it's already there, just not functional yet
- Load older messages when scrolling up (a conversation currently loads only its latest 100 messages)

**Real-time UX**
- Typing indicators ("alice is typing...")
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
- Smoother transitions for the sidebar and status dots (they currently update instantly)

**Bigger/stretch ideas**
- Browser notifications for new messages when the tab isn't focused
- Mobile-responsive layout (currently untested below desktop width)
- User status/bio text alongside online/offline
- Blocking users
- Group chats (currently 1-on-1 only)
- End-to-end message encryption (messages are currently stored as plaintext server-side)

## A note on deployment

I run this behind nginx (handling HTTPS and reverse-proxying everything to Node) with Cloudflare in front of it. That setup isn't covered here — this README only covers running the app itself.

## A note on AI assistance

I used Claude Code throughout this project, mainly as a learning aid — explaining concepts, reviewing my code, and catching bugs. It also helped speed up some structural/mechanical work (CSS layout, nginx config, refactoring sweeps) and suggested UI improvements. The foundations — auth, sessions, the WebSocket server, messaging and the heartbeat — I wrote myself.

Claude code was used to generate this README file also, as I am not great at those.

---

This is a learning project, built to understand the fundamentals rather than to be production-ready — expect rough edges.
