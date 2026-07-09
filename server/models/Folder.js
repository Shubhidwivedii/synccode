const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  parentFolder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

FolderSchema.index({ roomId: 1, parentFolder: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Folder', FolderSchema);
