const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const rooms = new Map();
const socketRooms = new Map();

function transformPosition(pos, againstOp) {
  /**
   * OPERATIONAL TRANSFORMATION — core algorithm
   *
   * When two operations happen concurrently, we need to adjust
   * one operation's position based on what the other operation did.
   *
   * Rules:
   * - If the other op inserted text BEFORE our position,
   *   shift our position right by the length of that insertion.
   * - If the other op deleted text BEFORE our position,
   *   shift our position left by the length of that deletion.
   * - If the other op happened AT OR AFTER our position, no change.
   */
  if (againstOp.type === 'insert') {
    if (againstOp.position <= pos) {
      return pos + againstOp.text.length;
    }
  } else if (againstOp.type === 'delete') {
    if (againstOp.position < pos) {
      return Math.max(againstOp.position, pos - againstOp.deletedLength);
    }
  }
  return pos;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socketRooms.set(socket.id, roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        code: '// Start coding here...',
        language: 'javascript',
        version: 0,        // document version — increments with every edit
        history: []        // log of all operations (useful for debugging)
      });
    }

    socket.emit('load-document', rooms.get(roomId));

    const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    io.to(roomId).emit('user-count', userCount);
  });

  socket.on('operation', ({ roomId, operation }) => {
    /**
     * An operation looks like:
     * {
     *   type: 'insert' | 'delete',
     *   position: number,       -- where in the document
     *   text: string,           -- text inserted (for insert ops)
     *   deletedLength: number,  -- chars deleted (for delete ops)
     *   baseVersion: number     -- document version this was based on
     * }
     *
     * If the client's baseVersion is behind the server's current version,
     * it means other operations happened in between — we need to transform
     * this operation's position against those intermediate operations.
     */
    const room = rooms.get(roomId);
    if (!room) return;

    let { position } = operation;

    // Get all operations that happened after the client's base version
    const concurrentOps = room.history.slice(operation.baseVersion);

    // Transform our position against each concurrent operation
    for (const pastOp of concurrentOps) {
      position = transformPosition(position, pastOp);
    }

    // Apply the transformed operation to the document
    const transformedOp = { ...operation, position };

    if (operation.type === 'insert') {
      room.code =
        room.code.slice(0, position) +
        operation.text +
        room.code.slice(position);
    } else if (operation.type === 'delete') {
      room.code =
        room.code.slice(0, position) +
        room.code.slice(position + operation.deletedLength);
    }

    // Increment version and log operation
    room.version++;
    room.history.push(transformedOp);

    // Broadcast the transformed operation + new version to all other clients
    socket.to(roomId).emit('operation', {
      operation: transformedOp,
      version: room.version
    });

    // Acknowledge back to sender with new version
    socket.emit('ack', { version: room.version });
  });

  // Keep simple code-change for language sync + full reloads
  socket.on('language-change', ({ roomId, language }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).language = language;
    }
    socket.to(roomId).emit('language-update', language);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const roomId = socketRooms.get(socket.id);
    if (roomId) {
      socketRooms.delete(socket.id);
      setTimeout(() => {
        const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        io.to(roomId).emit('user-count', userCount);
      }, 100);
    }
  });
});

app.get('/', (req, res) => res.send('SyncCode server is running'));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SyncCode server running on port ${PORT}`));