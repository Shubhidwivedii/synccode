<h1 align="center">🚀 SyncCode</h1>

<p align="center">
A real-time collaborative code editor with authenticated workspaces, persistent multi-file projects, and live synchronization powered by Socket.IO.
</p>

<p align="center">

![React](https://img.shields.io/badge/React-19-blue)
![Node](https://img.shields.io/badge/Node.js-20-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![Socket.IO](https://img.shields.io/badge/Socket.IO-RealTime-black)
![License](https://img.shields.io/badge/license-MIT-blue)

</p>

---

# ✨ Overview

SyncCode is a collaborative development platform where multiple developers can work inside the same coding workspace simultaneously.

Unlike screen sharing or pair programming over video calls, every participant gets their own Monaco editor while edits are synchronized instantly across all connected users.

Each room behaves like a lightweight cloud IDE with authentication, persistent storage, folder-based workspaces, and real-time collaboration.

---

# 🎥 Demo

| Frontend | Backend |
|----------|----------|
| https://synccode-xi.vercel.app | https://synccode-server-ihdh.onrender.com |

Backend Health

https://synccode-server-ihdh.onrender.com/api/health

> **Note**
> Render's free tier may take 20–40 seconds to wake the backend.

---

# 📸 Screenshots

> Add screenshots here

```
Home Page

Editor

Room History

Folder Explorer

Authentication
```

---

# 🌟 Features

### 🔐 Authentication

- JWT Authentication
- Password Hashing using bcrypt
- Google Login support
- Protected Routes

---

### ⚡ Real-Time Collaboration

- Live collaborative editing
- Socket.IO rooms
- File-level synchronization
- User presence
- Automatic editor updates

---

### 📂 Workspace Management

- Multiple files
- Folder support
- Default starter file
- Room history
- Language selection

---

### 💾 Persistence

Everything is stored in MongoDB:

- Users
- Rooms
- Files
- Folders
- Code
- Language
- Metadata

No work is lost after refreshes or server restarts.

---

### 🛠 Developer Experience

- Monaco Editor
- Syntax Highlighting
- Automatic Save
- Manual Save
- Winston Logging

---

# 🏗 Architecture

```text
                        +----------------------+
                        |      React App       |
                        |  Monaco + Socket.IO  |
                        +----------+-----------+
                                   |
                     REST API + WebSocket Events
                                   |
                        +----------v-----------+
                        | Express + Socket.IO  |
                        | Authentication       |
                        | Workspace APIs       |
                        +----------+-----------+
                                   |
                            Mongoose ODM
                                   |
                        +----------v-----------+
                        |   MongoDB Atlas      |
                        +----------------------+
```

---

# 🧩 Tech Stack

## Frontend

- React
- Vite
- Monaco Editor
- Socket.IO Client
- Axios
- Google OAuth

## Backend

- Node.js
- Express.js
- Socket.IO
- MongoDB Atlas
- Mongoose
- JWT
- bcryptjs
- Winston

---

# 📁 Project Structure

```
SyncCode
│
├── client
│   ├── src
│   ├── public
│   └── package.json
│
├── server
│   ├── middleware
│   ├── models
│   ├── utils
│   ├── server.js
│   └── package.json
│
└── README.md
```

---

# ⚙️ Installation

## Clone

```bash
git clone https://github.com/Shubhidwivedii/synccode.git

cd synccode
```

---

## Backend

```bash
cd server

npm install

npm run start
```

---

## Frontend

```bash
cd client

npm install

npm run dev
```

---

# 🔑 Environment Variables

### Server

```env
MONGODB_URI=

JWT_SECRET=

GOOGLE_CLIENT_ID=

PORT=3001
```

### Client

```env
VITE_SERVER_URL=

VITE_GOOGLE_CLIENT_ID=
```

---

# 🔄 Application Flow

```
User Login
      │
      ▼
Create / Join Room
      │
      ▼
Create Folder
      │
      ▼
Create Files
      │
      ▼
Edit with Monaco
      │
      ▼
Socket.IO Sync
      │
      ▼
MongoDB Persistence
```

---

# 📡 REST APIs

## Authentication

| Method | Endpoint |
|----------|----------------|
| POST | /api/auth/register |
| POST | /api/auth/login |
| POST | /api/auth/google |
| GET | /api/auth/me |

---

## Rooms

| Method | Endpoint |
|----------|----------------|
| GET | /api/rooms |
| POST | /api/rooms |
| GET | /api/rooms/:room/tree |

---

## Files

| Method | Endpoint |
|----------|----------------|
| POST | /files |
| PUT | /files/:id |
| GET | /tree |

---

# ⚡ Socket Events

| Event | Purpose |
|---------|----------------|
| join-room | Join collaboration room |
| join-file | Join active file |
| operation | Live editing |
| language-change | Sync language |
| room-tree | Workspace refresh |
| load-document | Initial file |
| user-count | Active users |

---

# 🚀 Deployment

## Frontend

Vercel

## Backend

Render

## Database

MongoDB Atlas

---

# 📈 Future Improvements

- Live cursors
- Remote selections
- File rename
- Delete file
- Nested folders
- Chat
- Code execution
- CRDT synchronization
- Version history
- Room permissions

---

# 💼 Resume Highlights

- Developed a production-ready collaborative code editor using React, Node.js, Socket.IO, and MongoDB.
- Built authenticated multi-user workspaces with persistent room history and file management.
- Engineered low-latency real-time synchronization using WebSockets and room-based collaboration.
- Designed REST APIs and MongoDB schemas for scalable workspace persistence.
- Deployed the application using Vercel, Render, and MongoDB Atlas.

---

# ⭐ Why This Project?

Most collaborative coding tools focus only on text synchronization.

SyncCode extends collaboration by combining authentication, persistent workspaces, multi-file project organization, and real-time editing into a lightweight cloud IDE experience.

It demonstrates concepts including:

- WebSockets
- Authentication
- Database Design
- REST APIs
- Deployment
- Real-Time Systems
- State Synchronization

making it an excellent full-stack systems project for interviews and portfolios.

---

# 👤 Author

**Shubhi Dwivedi**

GitHub: https://github.com/Shubhidwivedii
