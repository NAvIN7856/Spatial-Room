import Room from '../models/Room.js';

export const createRoom = async (req, res) => {
  const { name, password, isPrivate } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    const room = await Room.create({
      name,
      password: password || '',
      isPrivate: !!isPrivate,
      owner: req.user._id,
    });

    // Populate owner info before responding
    const populatedRoom = await Room.findById(room._id).populate('owner', 'username avatarColor');

    res.status(201).json(populatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRooms = async (req, res) => {
  try {
    // Only return public rooms or rooms owned by user
    const rooms = await Room.find({
      $or: [
        { isPrivate: false },
        { owner: req.user._id }
      ]
    }).populate('owner', 'username avatarColor');
    
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.owner.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this room' });
    }

    await Room.deleteOne({ _id: room._id });
    res.json({ message: 'Room removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyRoomPassword = async (req, res) => {
  const { password } = req.body;
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.isPrivate) {
      return res.json({ success: true });
    }

    if (room.password === password) {
      return res.json({ success: true });
    } else {
      return res.status(400).json({ message: 'Incorrect password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
