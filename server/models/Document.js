const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,       // fast lookup by roomId
  },
  code: {
    type: String,
    default: '// Start coding here...',
  },
  language: {
    type: String,
    default: 'javascript',
  },
  version: {
    type: Number,
    default: 0,
  },
  history: [{
    type: {
      type: String,
      enum: ['insert', 'delete'],
      required: true,
    },
    position: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
    },
    deletedLength: {
      type: Number,
    },
  }],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);
