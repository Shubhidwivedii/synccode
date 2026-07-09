const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  lastOpenedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

RoomSchema.index({ participants: 1, lastOpenedAt: -1 });

module.exports = mongoose.model('Room', RoomSchema);
