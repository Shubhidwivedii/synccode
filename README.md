# SyncCode
### Real-Time Collaborative Code Editor

SyncCode is a full-stack real-time collaborative code editor built on WebSockets and Monaco — the same editor engine that powers VS Code. Share a room link with anyone, and multiple developers can write, edit, and review code simultaneously with zero latency and no login required.

---

## Live Demo

**Frontend:** https://synccode-xi.vercel.app  
**Backend:** https://synccode-server-ihdh.onrender.com

> Hosted on Render free tier — the backend may take 30–60 seconds to wake up after inactivity. Once active, all real-time features work at full speed.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Real-Time Engine](#real-time-engine)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [API & Socket Events](#api--socket-events)
- [Supported Languages](#supported-languages)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Overview

Pair programming and real-time code review are painful over screen share — latency, one-sided control, and no shared state. SyncCode solves this by giving every participant a live, synchronized editor instance backed by a single source of truth on the server.

The core question SyncCode answers is:

> *What if multiple developers could edit the same file at the same time, from anywhere, with no setup?*

SyncCode does not require accounts, installs, or configuration. Open a link and start coding.

---

## Architecture

```
User A (Browser)              User B (Browser)
     |                              |
     | WebSocket                    | WebSocket
     v                              v
  Backend (Node.js + Socket.io)
     |
     +-- rooms Map (in-memory state per room)
     |     key = roomId
     |     value = { code, language }
     |
     +-- Socket Events:
           join-room      -> load current document state
           code-change    -> broadcast to all other room members
           language-change -> sync language across room
           disconnect     -> update live user count
     |
     v
  Broadcast to all room members (except sender)
     |
     v
  Monaco Editor updates in real time on all clients
```

The backend is a stateless WebSocket server. Each room's state lives in memory for the duration of the session. No database writes occur on every keystroke — only the latest document state is retained per room.

---

## Real-Time Engine

### Room System
Every collaborative session is identified by a unique 6-character alphanumeric room ID generated on the frontend. The room ID is embedded in the URL (`/room/:id`), making any session instantly shareable via a link copy.

### WebSocket Sync
SyncCode uses Socket.io over WebSocket for bidirectional real-time communication between clients and the server. When a user types, the full updated document is emitted to the server via a `code-change` event. The server updates its in-memory room state and broadcasts the new content to all other connected clients in the same room via `socket.to(roomId).emit()` — ensuring the sender never receives an echo of their own changes.

### Live User Presence
The server tracks which room each socket belongs to using a `socketRooms` Map. On every `join` and `disconnect` event, the server recalculates the room's active user count using Socket.io's built-in room adapter and broadcasts the updated count to all members. This powers the live "N online" indicator visible in the editor toolbar.

### Language Sync
Language selection is a first-class synchronized state. When any user changes the language via the toolbar dropdown, a `language-change` event is emitted to the server and broadcast to all room members — ensuring syntax highlighting stays consistent across all open instances of the same room.

---

## Tech Stack

### Backend
| Component | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Real-time | Socket.io |
| CORS | cors middleware |
| State | In-memory Map (per room) |
| Deployment | Render |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 |
| Build Tool | Vite |
| Editor | Monaco Editor (@monaco-editor/react) |
| Real-time | socket.io-client |
| Routing | window.history.pushState (no router dependency) |
| Styling | Inline styles (no CSS framework dependency) |
| Deployment | Vercel |

---

## Project Structure

```
synccode/
|
+-- server/
|   +-- server.js          # Express + Socket.io server, room state, all socket events
|   +-- package.json
|   +-- node_modules/
|
+-- client/
|   +-- src/
|   |   +-- App.jsx         # Home screen: create/join room, URL-based routing
|   |   +-- Editor.jsx      # Monaco editor, socket connection, real-time sync logic
|   |   +-- main.jsx        # React root mount
|   |   +-- index.css       # Global reset
|   +-- public/
|   +-- index.html
|   +-- vite.config.js
|   +-- vercel.json         # SPA rewrite rule for Vercel routing
|   +-- package.json
|   +-- node_modules/
|
+-- .gitignore
+-- README.md
```

---

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher

---

## Installation

### Backend Setup

```bash
cd synccode/server
npm install
```

### Frontend Setup

```bash
cd synccode/client
npm install
```

---

## Running the Application

Both the backend server and the frontend dev server must be running simultaneously in separate terminals.

### Start the Backend

```bash
cd synccode/server
node server.js
```

The backend will be available at `http://localhost:3001`.

### Start the Frontend

```bash
cd synccode/client
npm run dev
```

The frontend dev server will start at `http://localhost:5173`.

Open `http://localhost:5173` in your browser, click **Create New Room**, and share the URL with a collaborator to start editing together.

---

## API & Socket Events

### REST

| Method | Route | Description |
|---|---|---|
| GET | `/` | Health check — returns `"SyncCode server is running"` |

### Socket Events (Client → Server)

| Event | Payload | Description |
|---|---|---|
| `join-room` | `roomId: string` | Join a room; server responds with current document state |
| `code-change` | `{ roomId, code }` | Broadcast updated code to all other room members |
| `language-change` | `{ roomId, language }` | Sync language selection across all room members |

### Socket Events (Server → Client)

| Event | Payload | Description |
|---|---|---|
| `load-document` | `{ code, language }` | Sent on join; delivers current room state to new member |
| `code-update` | `code: string` | Received when another user changes the code |
| `language-update` | `language: string` | Received when another user changes the language |
| `user-count` | `count: number` | Sent to all room members on join or disconnect |

---

## Supported Languages

SyncCode supports syntax highlighting for the following languages via Monaco Editor:

| Language | Identifier |
|---|---|
| JavaScript | `javascript` |
| Python | `python` |
| Java | `java` |
| C++ | `cpp` |
| TypeScript | `typescript` |
| HTML | `html` |
| CSS | `css` |
| Rust | `rust` |

---

## Known Limitations

**In-memory state only.** Room state is stored in the server's memory. If the server restarts or the free-tier instance spins down due to inactivity, all active room content is lost. There is no persistence layer in the current version.

**No conflict resolution.** The current sync model is last-write-wins — the most recently received `code-change` payload becomes the document state. Simultaneous edits from two users at the exact same position can result in one user's change being overwritten. A full Operational Transformation or CRDT implementation is planned.

**No authentication.** Rooms are open to anyone with the link. There is no access control, password protection, or user identity in the current version.

**Single server instance.** The in-memory room state is not shared across multiple server processes. Horizontal scaling would require replacing the Map with a shared store such as Redis pub/sub.

**Free tier cold starts.** The Render free tier spins down inactive services. The first request after inactivity may take 30–60 seconds while the server wakes up.

---

## Roadmap

The following features are planned for future versions:

- **User authentication** — JWT-based login so users have persistent identities across sessions
- **Document persistence** — MongoDB integration to save room content; documents survive server restarts and are accessible by room ID
- **Room history** — each authenticated user can view a list of rooms they previously created or joined
- **Conflict resolution** — Operational Transformation implementation to correctly merge simultaneous edits at the same cursor position
- **Cursor presence** — see other users' cursor positions and selections highlighted in real time
- **Chat panel** — in-room text chat alongside the editor for communication without switching tools
- **Code execution** — run code directly in the browser via a sandboxed execution API

---

*SyncCode — write code together, instantly.*