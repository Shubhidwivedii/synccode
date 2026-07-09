const mongoose = require('mongoose');

const OperationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['insert', 'delete'],
    required: true,
  },
  position: {
    type: Number,
    required: true,
  },
  text: String,
  deletedLength: Number,
}, { _id: false });

const CodeFileSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
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
  history: {
    type: [OperationSchema],
    default: [],
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

CodeFileSchema.index({ roomId: 1, folder: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CodeFile', CodeFileSchema);
