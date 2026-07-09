# SyncCode

**A real-time collaborative code editor with authenticated rooms, persistent multi-file workspaces, and live editing.**

SyncCode is a full-stack collaboration platform for developers who want to write, review, and share code together in real time. It combines a VS Code-like Monaco editor, Socket.IO-powered live synchronization, JWT authentication, MongoDB persistence, room history, and folder-based multi-file workspaces.

## Live Demo

- Frontend: https://synccode-xi.vercel.app
- Backend: https://synccode-server-ihdh.onrender.com
- Backend health: https://synccode-server-ihdh.onrender.com/api/health

> The backend is hosted on Render. If the free-tier service is asleep, the first request can take a little while to wake up.

## Why SyncCode

Screen sharing is not enough for collaborative coding. Only one person can type comfortably, code is not saved as a shared workspace, and switching files is clumsy.

SyncCode gives every collaborator their own live editor connected to the same room. Users can create rooms, open past rooms, create folders and files, switch between files, and keep work saved in MongoDB.

## Features

- **Real-time collaborative editing** using Socket.IO rooms
- **Monaco Editor** for a familiar VS Code-like editing experience
- **JWT authentication** for signup, login, and protected workspace access
- **Google sign-in ready** through Google Identity Services
- **Persistent MongoDB storage** for rooms, folders, files, language, and code
- **Multi-file workspaces** with folder support inside each room
- **Past rooms** list for each authenticated user
- **Live user presence** showing how many users are online in a room
- **Language selection** for syntax highlighting
- **Manual save** plus automatic real-time persistence
- **Winston logging** for production-ready server logs
- **Deployment-ready frontend/backend** for Vercel and Render

## Product Flow

1. A user signs up or logs in.
2. The user creates a new room or opens a past room.
3. SyncCode creates a default `main.js` file for each new room.
4. The user can create folders and files inside the room.
5. Each file opens in Monaco Editor.
6. Code edits sync live to other users in the same room and file.
7. Files are saved in MongoDB and survive server restarts.

## Tech Stack

### Frontend

| Area | Technology |
|---|---|
| Framework | React |
| Build Tool | Vite |
| Editor | Monaco Editor |
| Real-time Client | socket.io-client |
| Auth UI | JWT auth, Google OAuth package |
| Deployment | Vercel |

### Backend

| Area | Technology |
|---|---|
| Runtime | Node.js |
| API Framework | Express |
| Real-time Server | Socket.IO |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Auth | JWT, bcryptjs, Google token verification |
| Logging | Winston |
| Deployment | Render |

## Architecture

```text
React + Monaco Editor
        |
        | REST API: auth, rooms, folders, files
        | Socket.IO: room/file editing events
        v
Node.js + Express + Socket.IO
        |
        | Mongoose models
        v
MongoDB Atlas
```

### Core Data Models

- **User**: username, password hash, optional Google profile, auth provider
- **Room**: room ID, owner, participants, last opened time
- **Folder**: room ID, folder name, parent folder, owner
- **CodeFile**: room ID, folder, filename, language, code, version, edit history
- **Document**: legacy compatibility model for older single-document rooms

## Project Structure

```text
synccode/
├── client/
│   ├── src/
│   │   ├── App.jsx          # Auth, room creation, past rooms
│   │   ├── Editor.jsx       # Monaco editor, folders/files, sockets
│   │   ├── main.jsx         # React root and Google provider
│   │   └── index.css
│   ├── package.json
│   └── vercel.json
│
├── server/
│   ├── middleware/
│   │   └── auth.js          # JWT and Socket.IO authentication
│   ├── models/
│   │   ├── CodeFile.js
│   │   ├── Document.js
│   │   ├── Folder.js
│   │   ├── Room.js
│   │   └── User.js
│   ├── utils/
│   │   └── logger.js        # Winston logger
│   ├── server.js            # Express API and Socket.IO server
│   └── package.json
│
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- MongoDB Atlas cluster

### 1. Clone the Repository

```bash
git clone https://github.com/Shubhidwivedii/synccode.git
cd synccode
```

### 2. Install Dependencies

Backend:

```bash
cd server
npm install
```

Frontend:

```bash
cd ../client
npm install
```

### 3. Configure Environment Variables

Create `server/.env`:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster-url/synccode?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=optional-google-client-id
PORT=3001
```

For local frontend development, create `client/.env` if needed:

```env
VITE_SERVER_URL=http://127.0.0.1:3001
VITE_GOOGLE_CLIENT_ID=optional-google-client-id
```

### 4. Run Locally

Start the backend:

```bash
cd server
node server.js
```

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Open the Vite URL, usually:

```text
http://127.0.0.1:5173
```

## API Overview

### Auth

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account with username/password |
| POST | `/api/auth/login` | Log in with username/password |
| POST | `/api/auth/google` | Log in with Google credential |
| GET | `/api/auth/me` | Get current authenticated user |

### Rooms and Files

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Check server and database health |
| GET | `/api/rooms` | List past rooms for current user |
| POST | `/api/rooms` | Create or reopen a room |
| GET | `/api/rooms/:roomId/tree` | Get folders and files for a room |
| POST | `/api/rooms/:roomId/folders` | Create a folder |
| POST | `/api/rooms/:roomId/files` | Create a file |
| PUT | `/api/rooms/:roomId/files/:fileId` | Save file contents |

## Socket Events

| Event | Direction | Description |
|---|---|---|
| `join-room` | Client to Server | Join a collaborative room |
| `join-file` | Client to Server | Join a file-specific collaboration channel |
| `operation` | Both | Send or receive insert/delete operations |
| `language-change` | Client to Server | Sync file language changes |
| `load-document` | Server to Client | Load file code, language, and version |
| `room-tree` | Server to Client | Load folders and files |
| `user-count` | Server to Client | Update online user count |
| `room-error` | Server to Client | Show room/editor errors |

## Deployment

### Backend on Render

Set these environment variables:

```env
MONGODB_URI=your-mongodb-atlas-uri
JWT_SECRET=your-production-jwt-secret
GOOGLE_CLIENT_ID=optional-google-client-id
```

Build command:

```bash
npm install
```

Start command:

```bash
node server.js
```

MongoDB Atlas must allow Render to connect. For quick setup, add this in Atlas Network Access:

```text
0.0.0.0/0
```

### Frontend on Vercel

Set:

```env
VITE_SERVER_URL=https://your-render-backend-url
VITE_GOOGLE_CLIENT_ID=optional-google-client-id
```

The included `vercel.json` rewrites all routes to `index.html`, so shared room links like `/room/abc123` work after refresh.

## Resume Bullets

- Built a real-time collaborative code editor with React, Monaco Editor, Socket.IO, Node.js, and MongoDB.
- Implemented JWT authentication, user-specific room history, and persistent multi-file workspaces with folders.
- Designed room/file-level collaboration channels with live user presence and synchronized editor state.
- Added production logging with Winston and deployed the frontend/backend using Vercel and Render.
- Debugged cloud deployment issues involving environment variables, MongoDB Atlas networking, and backend health checks.

## Roadmap

- File rename and delete
- Folder nesting UI
- Cursor presence and remote selections
- In-room chat
- Code execution sandbox
- Better conflict resolution with CRDT or full Operational Transformation
- Role-based room permissions

## Status

SyncCode is actively evolving as a placement-ready full-stack project. The current version demonstrates real-time systems, authentication, database modeling, deployment, and practical production debugging.

---

**SyncCode - code together, from anywhere.**
