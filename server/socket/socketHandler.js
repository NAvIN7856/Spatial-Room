// In-memory state of active rooms and users
// Format:
// {
//   [roomId]: {
//     [socketId]: {
//       userId: String,
//       username: String,
//       avatarColor: String,
//       x: Number,
//       y: Number,
//       rotation: Number,
//       isSpeaking: Boolean,
//       micActive: Boolean,
//       camActive: Boolean
//     }
//   }
// }
const roomsState = {};
const whiteboardHistories = {};
const screenShareOwners = {};

export const setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (${socket.user.username})`);

    // Track active room for this socket
    let currentRoomId = null;

    // Handle joining room
    socket.on('join-room', ({ roomId, x = 400, y = 300, rotation = 0 }) => {
      // If user was in another room, leave it first
      if (currentRoomId) {
        leaveRoom(socket, currentRoomId, io);
      }

      currentRoomId = roomId;
      socket.join(roomId);

      // Initialize room state if it doesn't exist
      if (!roomsState[roomId]) {
        roomsState[roomId] = {};
      }

      // Add user to room state
      roomsState[roomId][socket.id] = {
        userId: socket.user._id.toString(),
        username: socket.user.username,
        avatarColor: socket.user.avatarColor,
        x,
        y,
        rotation,
        isSpeaking: false,
        micActive: false,
        camActive: false
      };

      console.log(`User ${socket.user.username} joined room ${roomId}`);

      // Broadcast to other users in the room
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        user: roomsState[roomId][socket.id]
      });

      // Send the current list of users in the room to the newly joined user
      socket.emit('room-users', roomsState[roomId]);

      // Send drawing history if it exists
      if (whiteboardHistories[roomId]) {
        socket.emit('whiteboard-init', whiteboardHistories[roomId]);
      }

      // Send screen share owner status if someone is sharing
      if (screenShareOwners[roomId]) {
        socket.emit('screen-share-started', {
          socketId: screenShareOwners[roomId]
        });
      }
    });

    // Handle avatar movement
    socket.on('move', ({ x, y, rotation }) => {
      if (!currentRoomId || !roomsState[currentRoomId] || !roomsState[currentRoomId][socket.id]) {
        return;
      }

      // Update position in memory
      roomsState[currentRoomId][socket.id].x = x;
      roomsState[currentRoomId][socket.id].y = y;
      roomsState[currentRoomId][socket.id].rotation = rotation;

      // Broadcast position update to all other clients in the room
      socket.to(currentRoomId).emit('user-moved', {
        socketId: socket.id,
        x,
        y,
        rotation
      });
    });

    // Handle chat message
    socket.on('send-message', (text) => {
      if (!currentRoomId || !roomsState[currentRoomId] || !roomsState[currentRoomId][socket.id]) {
        return;
      }

      const sender = roomsState[currentRoomId][socket.id];
      const messageData = {
        id: `${socket.id}-${Date.now()}`,
        sender: sender.username,
        avatarColor: sender.avatarColor,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      // Broadcast message to everyone in the room (including sender)
      io.to(currentRoomId).emit('new-message', messageData);
    });

    // Handle media states (speaking, camera, mic) for future WebRTC integration
    socket.on('update-media-state', (states) => {
      if (!currentRoomId || !roomsState[currentRoomId] || !roomsState[currentRoomId][socket.id]) {
        return;
      }

      const userState = roomsState[currentRoomId][socket.id];
      if (states.isSpeaking !== undefined) userState.isSpeaking = states.isSpeaking;
      if (states.micActive !== undefined) userState.micActive = states.micActive;
      if (states.camActive !== undefined) userState.camActive = states.camActive;

      socket.to(currentRoomId).emit('user-media-state-updated', {
        socketId: socket.id,
        states: userState
      });
    });

    // Handle WebRTC Peer-to-Peer Signaling Relay
    socket.on('send-signal', ({ targetSocketId, signal }) => {
      io.to(targetSocketId).emit('receive-signal', {
        senderSocketId: socket.id,
        signal
      });
    });

    // Handle whiteboard drawing sync
    socket.on('draw-line', (lineData) => {
      if (!currentRoomId) return;
      if (!whiteboardHistories[currentRoomId]) {
        whiteboardHistories[currentRoomId] = [];
      }
      whiteboardHistories[currentRoomId].push(lineData);
      socket.to(currentRoomId).emit('draw-line', lineData);
    });

    // Handle whiteboard history pull
    socket.on('get-whiteboard-history', () => {
      if (currentRoomId && whiteboardHistories[currentRoomId]) {
        socket.emit('whiteboard-init', whiteboardHistories[currentRoomId]);
      }
    });

    // Handle clearing whiteboard with owner verification check
    socket.on('clear-whiteboard', async () => {
      if (!currentRoomId) return;
      try {
        const Room = (await import('../models/Room.js')).default;
        const room = await Room.findById(currentRoomId);
        
        if (room && room.owner.toString() === socket.user._id.toString()) {
          whiteboardHistories[currentRoomId] = [];
          io.to(currentRoomId).emit('clear-whiteboard');
        } else {
          socket.emit('error-notification', { message: 'Only the room owner can clear the whiteboard!' });
        }
      } catch (err) {
        console.error('Error verifying whiteboard clear authorization:', err.message);
      }
    });

    // Handle emoji reactions
    socket.on('emoji-reaction', (emoji) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('emoji-reaction', {
        socketId: socket.id,
        emoji
      });
    });

    // Handle screen share start
    socket.on('start-screen-share', () => {
      if (!currentRoomId) return;
      screenShareOwners[currentRoomId] = socket.id;
      socket.to(currentRoomId).emit('screen-share-started', {
        socketId: socket.id
      });
    });

    // Handle screen share stop
    socket.on('stop-screen-share', () => {
      if (!currentRoomId) return;
      if (screenShareOwners[currentRoomId] === socket.id) {
        delete screenShareOwners[currentRoomId];
        socket.to(currentRoomId).emit('screen-share-stopped', {
          socketId: socket.id
        });
      }
    });

    // Handle explicit leave-room
    socket.on('leave-room', () => {
      if (currentRoomId) {
        leaveRoom(socket, currentRoomId, io);
        currentRoomId = null;
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (${socket.user.username})`);
      if (currentRoomId) {
        leaveRoom(socket, currentRoomId, io);
      }
    });
  });
};

// Helper function to remove a user from room state and notify others
const leaveRoom = (socket, roomId, io) => {
  if (roomsState[roomId] && roomsState[roomId][socket.id]) {
    console.log(`User ${socket.user.username} left room ${roomId}`);
    
    // Remove from in-memory state
    delete roomsState[roomId][socket.id];

    // Notify other users in the room
    io.to(roomId).emit('user-left', { socketId: socket.id });

    // Stop screen share if this user was sharing
    if (screenShareOwners[roomId] === socket.id) {
      delete screenShareOwners[roomId];
      io.to(roomId).emit('screen-share-stopped', { socketId: socket.id });
    }

    // Clean up room if no users remain
    if (Object.keys(roomsState[roomId]).length === 0) {
      delete roomsState[roomId];
      delete whiteboardHistories[roomId];
      delete screenShareOwners[roomId];
    }
  }
  socket.leave(roomId);
};
