require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const Document = require('./models/Document');
const User = require('./models/User');
const Room = require('./models/Room');
const Folder = require('./models/Folder');
const CodeFile = require('./models/CodeFile');
const logger = require('./utils/logger');
const { authenticate, authenticateSocket, signToken } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

mongoose.set('bufferCommands', false);

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => logger.info('Connected to MongoDB'))
  .catch((err) => logger.error('MongoDB connection error', { error: err.message }));

const socketRooms = new Map();
const socketFileRooms = new Map();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function sanitizeUsername(username = '') {
  return username.trim().toLowerCase();
}

function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

function requireDatabase(req, res, next) {
  if (!isDatabaseReady()) {
    return res.status(503).json({
      error: 'Database unavailable. Check MONGODB_URI and MongoDB Atlas network access.',
    });
  }

  next();
}

function serializeUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
  };
}

function sanitizeName(name = '') {
  return name.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
}

function applyOperation(code, operation) {
  if (!operation || typeof operation.position !== 'number') {
    throw new Error('Invalid operation');
  }

  const position = Math.max(0, Math.min(operation.position, code.length));

  if (operation.type === 'insert') {
    const text = typeof operation.text === 'string' ? operation.text : '';
    return code.slice(0, position) + text + code.slice(position);
  }

  if (operation.type === 'delete') {
    const deletedLength = Math.max(0, operation.deletedLength || 0);
    return code.slice(0, position) + code.slice(position + deletedLength);
  }

  throw new Error('Unsupported operation');
}

function transformPosition(position, againstOp) {
  if (againstOp.type === 'insert' && againstOp.position <= position) {
    return position + (againstOp.text || '').length;
  }

  if (againstOp.type === 'delete' && againstOp.position < position) {
    return Math.max(againstOp.position, position - (againstOp.deletedLength || 0));
  }

  return position;
}

function transformOperation(operation, history, baseVersion = history.length) {
  const transformed = { ...operation };
  const concurrentOps = history.slice(Math.max(0, baseVersion));

  for (const pastOp of concurrentOps) {
    transformed.position = transformPosition(transformed.position, pastOp);
  }

  return transformed;
}

async function touchRoom(roomId, userId) {
  const update = {
    $setOnInsert: { roomId, owner: userId },
    $addToSet: { participants: userId },
    $set: { lastOpenedAt: new Date() },
  };

  return Room.findOneAndUpdate({ roomId }, update, { upsert: true, new: true });
}

async function ensureDefaultFile(roomId, userId) {
  let file = await CodeFile.findOne({ roomId }).sort({ createdAt: 1 });

  if (!file) {
    const legacyDoc = await Document.findOne({ roomId });
    file = await CodeFile.create({
      roomId,
      name: 'main.js',
      code: legacyDoc?.code || '// Start coding here...',
      language: legacyDoc?.language || 'javascript',
      version: legacyDoc?.version || 0,
      history: legacyDoc?.history || [],
      owner: userId,
    });
  }

  return file;
}

async function getRoomTree(roomId, userId) {
  await touchRoom(roomId, userId);
  const defaultFile = await ensureDefaultFile(roomId, userId);
  const [folders, files] = await Promise.all([
    Folder.find({ roomId }).sort({ name: 1 }).select('_id name parentFolder createdAt updatedAt'),
    CodeFile.find({ roomId }).sort({ folder: 1, name: 1 }).select('_id name folder language lastModified updatedAt'),
  ]);

  return { folders, files, activeFileId: defaultFile._id };
}

app.get('/', (req, res) => res.send('SyncCode server is running'));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    database: isDatabaseReady() ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', requireDatabase);
app.use('/api/rooms', requireDatabase);
app.use('/api/document', requireDatabase);

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = sanitizeUsername(req.body.username);
    const password = req.body.password || '';

    if (username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Username must be 3+ chars and password 6+ chars' });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, passwordHash });
    const token = signToken(user);

    logger.info('User registered', { userId: user._id.toString(), username });
    res.status(201).json({ token, user: serializeUser(user) });
  } catch (err) {
    logger.error('Registration failed', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = sanitizeUsername(req.body.username);
    const user = await User.findOne({ username });

    if (!user || !user.passwordHash || !await bcrypt.compare(req.body.password || '', user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user);
    logger.info('User logged in', { userId: user._id.toString(), username });
    res.json({ token, user: serializeUser(user) });
  } catch (err) {
    logger.error('Login failed', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Google sign-in is not configured' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email_verified) {
      return res.status(401).json({ error: 'Google email is not verified' });
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });

    if (!user) {
      user = await User.create({
        username: email,
        email,
        googleId: payload.sub,
        avatarUrl: payload.picture,
        authProvider: 'google',
      });
    } else {
      user.googleId = user.googleId || payload.sub;
      user.email = user.email || email;
      user.avatarUrl = payload.picture || user.avatarUrl;
      user.authProvider = user.authProvider === 'local' ? 'local' : 'google';
      await user.save();
    }

    const token = signToken(user);
    logger.info('User logged in with Google', { userId: user._id.toString(), email });
    res.json({ token, user: serializeUser(user) });
  } catch (err) {
    logger.error('Google login failed', { error: err.message });
    res.status(401).json({ error: 'Google sign-in failed' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

app.get('/api/rooms', authenticate, async (req, res) => {
  try {
    const rooms = await Room.find({ participants: req.user._id })
      .sort({ lastOpenedAt: -1 })
      .limit(30)
      .select('roomId lastOpenedAt updatedAt createdAt');

    res.json({ rooms });
  } catch (err) {
    logger.error('Room history failed', { error: err.message, userId: req.user._id.toString() });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/rooms', authenticate, async (req, res) => {
  try {
    const roomId = (req.body.roomId || '').trim();
    if (!/^[a-z0-9-]{3,64}$/i.test(roomId)) {
      return res.status(400).json({ error: 'Invalid room id' });
    }

    const room = await touchRoom(roomId, req.user._id);
    await ensureDefaultFile(roomId, req.user._id);

    res.status(201).json({ room });
  } catch (err) {
    logger.error('Room create failed', { error: err.message, userId: req.user._id.toString() });
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rooms/:roomId/tree', authenticate, async (req, res) => {
  try {
    const tree = await getRoomTree(req.params.roomId, req.user._id);
    res.json(tree);
  } catch (err) {
    logger.error('Room tree failed', { error: err.message, roomId: req.params.roomId });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/rooms/:roomId/folders', authenticate, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Folder name is required' });

    const parentFolder = req.body.parentFolder || null;
    if (parentFolder) {
      const parent = await Folder.findOne({ _id: parentFolder, roomId: req.params.roomId });
      if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
    }

    await touchRoom(req.params.roomId, req.user._id);
    const folder = await Folder.create({
      roomId: req.params.roomId,
      name,
      parentFolder,
      owner: req.user._id,
    });

    res.status(201).json({ folder });
  } catch (err) {
    const status = err.code === 11000 ? 409 : 500;
    logger.error('Folder create failed', { error: err.message, roomId: req.params.roomId });
    res.status(status).json({ error: status === 409 ? 'Folder already exists here' : 'Server error' });
  }
});

app.post('/api/rooms/:roomId/files', authenticate, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'File name is required' });

    const folder = req.body.folder || null;
    if (folder) {
      const parent = await Folder.findOne({ _id: folder, roomId: req.params.roomId });
      if (!parent) return res.status(404).json({ error: 'Folder not found' });
    }

    await touchRoom(req.params.roomId, req.user._id);
    const file = await CodeFile.create({
      roomId: req.params.roomId,
      folder,
      name,
      language: req.body.language || 'javascript',
      code: req.body.code || '// Start coding here...',
      owner: req.user._id,
    });

    res.status(201).json({ file });
  } catch (err) {
    const status = err.code === 11000 ? 409 : 500;
    logger.error('File create failed', { error: err.message, roomId: req.params.roomId });
    res.status(status).json({ error: status === 409 ? 'File already exists here' : 'Server error' });
  }
});

app.put('/api/rooms/:roomId/files/:fileId', authenticate, async (req, res) => {
  try {
    const file = await CodeFile.findOneAndUpdate(
      { _id: req.params.fileId, roomId: req.params.roomId },
      {
        code: req.body.code ?? '',
        language: req.body.language || 'javascript',
        lastModified: new Date(),
        owner: req.user._id,
      },
      { new: true }
    );

    if (!file) return res.status(404).json({ error: 'File not found' });

    await touchRoom(req.params.roomId, req.user._id);
    res.json({ file });
  } catch (err) {
    logger.error('File save failed', { error: err.message, roomId: req.params.roomId, fileId: req.params.fileId });
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/document/:roomId', authenticate, async (req, res) => {
  try {
    const doc = await Document.findOne({ roomId: req.params.roomId });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    logger.error('Document fetch failed', { error: err.message, roomId: req.params.roomId });
    res.status(500).json({ error: 'Server error' });
  }
});

io.use(authenticateSocket);

io.on('connection', (socket) => {
  logger.info('User connected', { socketId: socket.id, userId: socket.user._id.toString() });

  socket.on('join-room', async (roomId) => {
    try {
      socket.join(roomId);
      socketRooms.set(socket.id, roomId);
      await touchRoom(roomId, socket.user._id);

      const doc = await ensureDefaultFile(roomId, socket.user._id);
      const defaultChannel = `file:${doc._id}`;
      socket.join(defaultChannel);
      socketFileRooms.set(socket.id, defaultChannel);

      socket.emit('load-document', {
        fileId: doc._id,
        code: doc.code,
        language: doc.language,
        version: doc.version,
      });
      socket.emit('room-tree', await getRoomTree(roomId, socket.user._id));

      const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      io.to(roomId).emit('user-count', userCount);
    } catch (err) {
      logger.error('Join room failed', {
        error: err.message,
        roomId,
        userId: socket.user._id.toString(),
      });
      socket.emit('room-error', 'Unable to load room');
    }
  });

  socket.on('join-file', async ({ roomId, fileId }) => {
    try {
      const file = await CodeFile.findOne({ _id: fileId, roomId });
      if (!file) return socket.emit('room-error', 'File not found');

      const previousRoom = socketRooms.get(socket.id);
      if (!previousRoom) {
        socket.join(roomId);
        socketRooms.set(socket.id, roomId);
      }

      const previousFileRoom = socketFileRooms.get(socket.id);
      if (previousFileRoom) socket.leave(previousFileRoom);

      const channel = `file:${file._id}`;
      socket.join(channel);
      socketFileRooms.set(socket.id, channel);
      await touchRoom(roomId, socket.user._id);

      socket.emit('load-document', {
        fileId: file._id,
        code: file.code,
        language: file.language,
        version: file.version,
      });
    } catch (err) {
      logger.error('Join file failed', { error: err.message, fileId, roomId });
      socket.emit('room-error', 'Unable to load file');
    }
  });

  socket.on('operation', async ({ roomId, fileId, operation }) => {
    try {
      const doc = fileId
        ? await CodeFile.findOne({ _id: fileId, roomId })
        : await ensureDefaultFile(roomId, socket.user._id);
      if (!doc) return socket.emit('room-error', 'File not found');

      if (typeof operation.baseVersion === 'number' && operation.baseVersion !== doc.version) {
        operation = transformOperation(operation, doc.history || [], operation.baseVersion);
      }

      doc.code = applyOperation(doc.code, operation);
      doc.version += 1;
      if (!Array.isArray(doc.history)) doc.history = [];
      doc.history.push(operation);
      doc.lastModified = new Date();
      await doc.save();
      await touchRoom(roomId, socket.user._id);

      socket.to(`file:${doc._id}`).emit('operation', { operation, version: doc.version });
      socket.emit('ack', { version: doc.version });
    } catch (err) {
      logger.error('Operation failed', {
        error: err.message,
        roomId,
        userId: socket.user._id.toString(),
      });
      socket.emit('room-error', 'Unable to save edit');
    }
  });

  socket.on('code-change', async ({ roomId, code }) => {
    try {
      const doc = await Document.findOneAndUpdate(
        { roomId },
        {
          $set: { code, lastModified: new Date(), owner: socket.user._id },
          $inc: { version: 1 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await touchRoom(roomId, socket.user._id);
      socket.to(roomId).emit('code-update', code);
      socket.emit('ack', { version: doc.version });
    } catch (err) {
      logger.error('Code save failed', { error: err.message, roomId });
    }
  });

  socket.on('language-change', async ({ roomId, fileId, language }) => {
    try {
      const file = fileId
        ? await CodeFile.findOneAndUpdate(
          { _id: fileId, roomId },
          { language, lastModified: new Date(), owner: socket.user._id },
          { new: true }
        )
        : await ensureDefaultFile(roomId, socket.user._id);

      if (!file) return socket.emit('room-error', 'File not found');
      await touchRoom(roomId, socket.user._id);
      socket.to(`file:${file._id}`).emit('language-update', language);
    } catch (err) {
      logger.error('Language save failed', { error: err.message, roomId });
    }
  });

  socket.on('disconnect', () => {
    logger.info('User disconnected', { socketId: socket.id });
    const roomId = socketRooms.get(socket.id);
    const fileRoom = socketFileRooms.get(socket.id);
    if (fileRoom) socketFileRooms.delete(socket.id);
    if (roomId) {
      socketRooms.delete(socket.id);
      setTimeout(() => {
        const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        io.to(roomId).emit('user-count', userCount);
      }, 100);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => logger.info('SyncCode server started', { port: PORT }));
