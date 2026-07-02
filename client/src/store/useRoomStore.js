import { create } from 'zustand';
import { io } from 'socket.io-client';
import { spatialAudioEngine } from '../audio/spatialAudioEngine';

const preferStereoOpus = (sdp) => {
  let lines = sdp.split('\r\n');
  let opusPayload = null;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('opus/48000')) {
      const match = lines[i].match(/a=rtpmap:(\d+)\s+opus\/48000/);
      if (match) {
        opusPayload = match[1];
        break;
      }
    }
  }

  if (opusPayload) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`a=fmtp:${opusPayload}`)) {
        if (!lines[i].includes('stereo=1')) {
          lines[i] = lines[i] + ';stereo=1;sprop-stereo=1;maxaveragebitrate=128000';
        }
        break;
      }
    }
  }

  return lines.join('\r\n');
};

export const useRoomStore = create((set, get) => ({
  rooms: [],
  currentRoom: null,
  roomUsers: {},
  chatMessages: [],
  socket: null,
  loading: false,
  error: null,

  // WebRTC-specific states
  localStream: null,
  peerConnections: {}, // socketId -> RTCPeerConnection
  remoteStreams: {},    // socketId -> MediaStream

  // Screen Sharing states
  localScreenStream: null,
  screenSenders: {}, // socketId -> RTCRtpSender
  remoteScreenStreams: {}, // socketId -> MediaStream
  screenShareOwnerSocketId: null,

  // Available audio devices (refreshed on mount and device-change events)
  availableInputDevices: [],
  availableOutputDevices: [],

  fetchRooms: async (token) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/rooms', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch rooms');
      set({ rooms: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  createRoom: async (roomData, token) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(roomData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create room');
      
      set((state) => ({
        rooms: [...state.rooms, data],
        loading: false,
      }));
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  deleteRoom: async (roomId, token) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete room');
      }
      set((state) => ({
        rooms: state.rooms.filter((r) => r._id !== roomId),
      }));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  verifyPassword: async (roomId, password, token) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      return response.ok && data.success;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  // Initialize browser microphone stream
  initLocalStream: async () => {
    // Check if stream already exists
    if (get().localStream) return get().localStream;

    try {
      console.log('Requesting local microphone stream...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },   // Mono is cleaner for voice + spatial audio
          latency: { ideal: 0.01 },
          suppressLocalAudioPlayback: true,
        },
        video: false,
      });

      // Initially mute the local stream tracks
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });

      set({ localStream: stream });
      console.log('Local stream initialized successfully');
      return stream;
    } catch (err) {
      console.error('Failed to get local stream:', err.message);
      set({ error: 'Failed to access microphone' });
      return null;
    }
  },

  // Enable/disable local audio track (Mute/Unmute toggle)
  toggleMicTrack: (muted) => {
    const stream = get().localStream;
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
      console.log(`Local microphone tracks ${muted ? 'disabled (muted)' : 'enabled (unmuted)'}`);
    }
  },

  // Refresh the enumerated device lists (called on mount + devicechange)
  refreshDevices: async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      set({
        availableInputDevices: devices.filter(d => d.kind === 'audioinput'),
        availableOutputDevices: devices.filter(d => d.kind === 'audiooutput'),
      });
    } catch (err) {
      console.warn('[Devices] enumerate failed:', err.message);
    }
  },

  /**
   * Switch to a different microphone without reconnecting.
   * 1. Requests a new stream for the chosen device.
   * 2. Replaces the audio sender track in every active RTCPeerConnection.
   * 3. Stops the old stream tracks.
   * @param {string} deviceId  - audioinput deviceId
   * @param {boolean} currentMuted - whether mic is currently muted (preserves state)
   */
  switchMicDevice: async (deviceId, currentMuted) => {
    try {
      console.log('[Mic] Switching input device to:', deviceId);

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
          latency: { ideal: 0.01 },
          suppressLocalAudioPlayback: true,
        },
        video: false,
      });

      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) throw new Error('No audio track in new stream');

      // Preserve current muted state
      newTrack.enabled = !currentMuted;

      // Replace track in every active peer connection (no renegotiation needed)
      const pcs = get().peerConnections;
      const replacePromises = Object.entries(pcs).map(async ([socketId, pc]) => {
        if (pc.signalingState === 'closed') return;
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          try {
            await sender.replaceTrack(newTrack);
            console.log(`[Mic] Track replaced for peer: ${socketId}`);
          } catch (err) {
            console.warn(`[Mic] replaceTrack failed for ${socketId}:`, err.message);
          }
        }
      });
      await Promise.all(replacePromises);

      // Stop old stream tracks
      const oldStream = get().localStream;
      if (oldStream) {
        oldStream.getAudioTracks().forEach(t => t.stop());
      }

      // Track the new device id in audio engine
      spatialAudioEngine.setCurrentInputDeviceId(deviceId);

      set({ localStream: newStream });
      console.log('[Mic] Device switch complete');
      return true;
    } catch (err) {
      console.error('[Mic] switchMicDevice failed:', err.message);
      return false;
    }
  },

  connectSocket: (token) => {
    const existingSocket = get().socket;
    if (existingSocket && existingSocket.connected) return;

    const socket = io('/', {
      auth: { token },
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('Socket connected successfully with ID:', socket.id);
    });

    // Listen for room users list
    socket.on('room-users', (users) => {
      set({ roomUsers: users });
      
      // We are joining the room. Existing users in this list will initiate the connection with us.
      // We just need to sit back and wait for incoming offers.
    });

    // Listen for another user joining the room
    socket.on('user-joined', ({ socketId, user }) => {
      console.log(`User joined room: ${user.username} (${socketId})`);
      set((state) => ({
        roomUsers: {
          ...state.roomUsers,
          [socketId]: user,
        },
      }));

      // Since we are the existing user, we INITIATE the WebRTC PeerConnection with the newly joined user
      get().createPeerConnection(socketId, true);
    });

    // Listen for incoming WebRTC signaling data
    socket.on('receive-signal', ({ senderSocketId, signal }) => {
      get().handleIncomingSignal(senderSocketId, signal);
    });

    // Listen for another user moving
    socket.on('user-moved', ({ socketId, x, y, rotation }) => {
      set((state) => {
        const user = state.roomUsers[socketId];
        if (!user) return {};
        
        // Update spatial audio engine positioning
        spatialAudioEngine.updatePeerPosition(socketId, x, y, rotation);

        return {
          roomUsers: {
            ...state.roomUsers,
            [socketId]: {
              ...user,
              x,
              y,
              rotation,
            },
          },
        };
      });
    });

    // Listen for media state changes
    socket.on('user-media-state-updated', ({ socketId, states }) => {
      set((state) => {
        const user = state.roomUsers[socketId];
        if (!user) return {};
        return {
          roomUsers: {
            ...state.roomUsers,
            [socketId]: {
              ...user,
              ...states,
            },
          },
        };
      });
    });

    // Listen for chat messages
    socket.on('new-message', (message) => {
      set((state) => ({
        chatMessages: [...state.chatMessages, message],
      }));
    });

    // Listen for another user leaving
    socket.on('user-left', ({ socketId }) => {
      set((state) => {
        const updatedUsers = { ...state.roomUsers };
        delete updatedUsers[socketId];
        return { roomUsers: updatedUsers };
      });

      // Close Peer Connection and clean up audio
      get().cleanupPeerConnection(socketId);
    });

    // Listen for screen share start
    socket.on('screen-share-started', ({ socketId }) => {
      console.log(`Peer started screen sharing: ${socketId}`);
      set({ screenShareOwnerSocketId: socketId });
    });

    // Listen for screen share stop
    socket.on('screen-share-stopped', ({ socketId }) => {
      console.log(`Peer stopped screen sharing: ${socketId}`);
      set((state) => {
        const screenStreams = { ...state.remoteScreenStreams };
        delete screenStreams[socketId];
        return {
          screenShareOwnerSocketId: null,
          remoteScreenStreams: screenStreams
        };
      });
    });

    // Listen for error notifications
    socket.on('error-notification', ({ message }) => {
      alert(message);
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
    }

    // Clean up WebRTC audio streams
    const localStream = get().localStream;
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Clean up WebRTC screen streams
    const localScreenStream = get().localScreenStream;
    if (localScreenStream) {
      localScreenStream.getTracks().forEach((track) => track.stop());
    }

    // Close all peer connections
    Object.keys(get().peerConnections).forEach((socketId) => {
      get().cleanupPeerConnection(socketId);
    });

    spatialAudioEngine.close();

    set({ 
      socket: null, 
      roomUsers: {}, 
      chatMessages: [], 
      localStream: null, 
      peerConnections: {}, 
      remoteStreams: {},
      localScreenStream: null,
      screenSenders: {},
      remoteScreenStreams: {},
      screenShareOwnerSocketId: null
    });
  },

  joinRoom: (room, x = 400, y = 300, rotation = 0) => {
    const socket = get().socket;
    if (!socket) return;

    // Reset spatial audio engine context
    spatialAudioEngine.initAudioContext();

    socket.emit('join-room', { roomId: room._id, x, y, rotation });
    set({ currentRoom: room, chatMessages: [] });
  },

  leaveRoom: () => {
    const socket = get().socket;
    if (socket) {
      socket.emit('leave-room');
    }

    // Clean up active peers and remote streams
    Object.keys(get().peerConnections).forEach((socketId) => {
      get().cleanupPeerConnection(socketId);
    });

    set({ currentRoom: null, roomUsers: {}, chatMessages: [], peerConnections: {}, remoteStreams: {} });
  },

  // WebRTC Peer Connection Core Logic
  createPeerConnection: async (targetSocketId, isInitiator) => {
    const existingPC = get().peerConnections[targetSocketId];
    if (existingPC) return existingPC;

    console.log(`Creating RTCPeerConnection for target: ${targetSocketId} (Initiator: ${isInitiator})`);
    
    // Create connection with public Google STUN server
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
          ]
        }
      ]
    });

    // Handle local ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && get().socket) {
        get().socket.emit('send-signal', {
          targetSocketId,
          signal: { candidate: event.candidate },
        });
      }
    };

    // Handle incoming streams
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];

      if (event.track.kind === 'video') {
        console.log(`Received remote screen sharing video track from peer: ${targetSocketId}`);
        set((state) => ({
          remoteScreenStreams: {
            ...state.remoteScreenStreams,
            [targetSocketId]: remoteStream,
          },
        }));
      } else {
        console.log(`Received remote audio track stream from peer: ${targetSocketId}`);
        set((state) => ({
          remoteStreams: {
            ...state.remoteStreams,
            [targetSocketId]: remoteStream,
          },
        }));

        // Route the stream through our Spatial Audio Engine
        spatialAudioEngine.setupSpatialNode(targetSocketId, remoteStream);
        
        // Update panner node position immediately with whatever last position we have
        const peer = get().roomUsers[targetSocketId];
        if (peer) {
          spatialAudioEngine.updatePeerPosition(targetSocketId, peer.x, peer.y, peer.rotation);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${targetSocketId}: ${pc.connectionState}`);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        get().cleanupPeerConnection(targetSocketId);
      }
    };

    // Add local mic audio tracks to the connection
    let localStream = get().localStream;
    if (!localStream) {
      // Lazy load localStream if not initialized
      localStream = await get().initLocalStream();
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Save peer connection in state dictionary
    set((state) => ({
      peerConnections: {
        ...state.peerConnections,
        [targetSocketId]: pc,
      },
    }));

    // If we are initiating the connection, create and send an SDP offer
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        const mungedSDP = preferStereoOpus(offer.sdp);
        const mungedOffer = new RTCSessionDescription({ type: 'offer', sdp: mungedSDP });
        await pc.setLocalDescription(mungedOffer);
        console.log(`Sending SDP offer to peer: ${targetSocketId}`);
        get().socket.emit('send-signal', {
          targetSocketId,
          signal: { sdp: mungedOffer },
        });
      } catch (err) {
        console.error('Failed to create/send SDP offer:', err.message);
      }
    }

    return pc;
  },

  // Handle incoming signaling data from signaling server
  handleIncomingSignal: async (senderSocketId, signal) => {
    let pc = get().peerConnections[senderSocketId];

    // If no peer connection exists for this sender yet, create one
    if (!pc) {
      pc = await get().createPeerConnection(senderSocketId, false);
    }

    try {
      if (signal.sdp) {
        const desc = new RTCSessionDescription(signal.sdp);
        await pc.setRemoteDescription(desc);
        console.log(`Applied Remote Description type: ${desc.type} from: ${senderSocketId}`);

        // If it's an offer, we must answer it
        if (desc.type === 'offer') {
          const answer = await pc.createAnswer();
          const mungedSDP = preferStereoOpus(answer.sdp);
          const mungedAnswer = new RTCSessionDescription({ type: 'answer', sdp: mungedSDP });
          await pc.setLocalDescription(mungedAnswer);
          console.log(`Sending SDP answer to: ${senderSocketId}`);
          get().socket.emit('send-signal', {
            targetSocketId: senderSocketId,
            signal: { sdp: mungedAnswer },
          });
        }
      } else if (signal.candidate) {
        const candidate = new RTCIceCandidate(signal.candidate);
        await pc.addIceCandidate(candidate);
        console.log(`Successfully added ICE candidate from: ${senderSocketId}`);
      }
    } catch (err) {
      console.error(`Error handling WebRTC signal from ${senderSocketId}:`, err.message);
    }
  },

  // Close and clean up a specific peer connection
  cleanupPeerConnection: (socketId) => {
    const pc = get().peerConnections[socketId];
    if (pc) {
      pc.close();
      console.log(`Closed RTCPeerConnection for: ${socketId}`);
    }

    // Disconnect spatial audio engine
    spatialAudioEngine.removeSpatialNode(socketId);

    set((state) => {
      const pcs = { ...state.peerConnections };
      const streams = { ...state.remoteStreams };
      const screenStreams = { ...state.remoteScreenStreams };
      const senders = { ...state.screenSenders };
      
      delete pcs[socketId];
      delete streams[socketId];
      delete screenStreams[socketId];
      delete senders[socketId];
      
      // If the closed connection belonged to the screen share owner, reset it
      const resetScreenOwner = state.screenShareOwnerSocketId === socketId ? null : state.screenShareOwnerSocketId;
      
      return { 
        peerConnections: pcs, 
        remoteStreams: streams, 
        remoteScreenStreams: screenStreams,
        screenSenders: senders,
        screenShareOwnerSocketId: resetScreenOwner
      };
    });
  },

  sendMove: (x, y, rotation) => {
    const socket = get().socket;
    if (!socket) return;

    socket.emit('move', { x, y, rotation });
    
    // Update self locally
    set((state) => {
      const selfSocketId = socket.id;
      if (!selfSocketId || !state.roomUsers[selfSocketId]) return {};
      
      // Update listener position inside spatial audio engine
      spatialAudioEngine.updateListener(x, y, rotation);

      return {
        roomUsers: {
          ...state.roomUsers,
          [selfSocketId]: {
            ...state.roomUsers[selfSocketId],
            x,
            y,
            rotation,
          },
        },
      };
    });
  },

  sendChatMessage: (text) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('send-message', text);
  },

  sendDrawLine: (lineData) => {
    const socket = get().socket;
    if (socket) {
      socket.emit('draw-line', lineData);
    }
  },

  sendClearWhiteboard: () => {
    const socket = get().socket;
    if (socket) {
      socket.emit('clear-whiteboard');
    }
  },

  sendEmojiReaction: (emoji) => {
    const socket = get().socket;
    if (socket) {
      socket.emit('emoji-reaction', emoji);
    }
  },

  updateLocalMediaState: (states) => {
    const socket = get().socket;
    if (!socket) return;

    socket.emit('update-media-state', states);

    // Update self locally
    set((state) => {
      const selfSocketId = socket.id;
      if (!selfSocketId || !state.roomUsers[selfSocketId]) return {};
      return {
        roomUsers: {
          ...state.roomUsers,
          [selfSocketId]: {
            ...state.roomUsers[selfSocketId],
            ...states,
          },
        },
      };
    });
  },

  startScreenShare: async () => {
    if (get().localScreenStream) return;
    const socket = get().socket;
    if (!socket) return;

    try {
      console.log('Requesting display media for screen share...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 15, max: 30 }
        },
        audio: false
      });

      const videoTrack = stream.getVideoTracks()[0];

      // Add track to all active peer connections
      const senders = {};
      const pcs = get().peerConnections;
      
      for (const [socketId, pc] of Object.entries(pcs)) {
        if (pc.signalingState !== 'closed') {
          try {
            const sender = pc.addTrack(videoTrack, stream);
            senders[socketId] = sender;
            
            // Trigger WebRTC renegotiation
            const offer = await pc.createOffer();
            const mungedSDP = preferStereoOpus(offer.sdp);
            const mungedOffer = new RTCSessionDescription({ type: 'offer', sdp: mungedSDP });
            await pc.setLocalDescription(mungedOffer);
            socket.emit('send-signal', {
              targetSocketId: socketId,
              signal: { sdp: mungedOffer }
            });
          } catch (err) {
            console.error(`Failed to add video track to peer ${socketId}:`, err);
          }
        }
      }

      // Listen for the track ending (from browser stop share button)
      videoTrack.onended = () => {
        get().stopScreenShare();
      };

      set({
        localScreenStream: stream,
        screenSenders: senders,
        screenShareOwnerSocketId: socket.id
      });

      socket.emit('start-screen-share');
      console.log('Screen sharing initialized successfully');
    } catch (err) {
      console.error('Failed to get display media:', err.message);
    }
  },

  stopScreenShare: async () => {
    const stream = get().localScreenStream;
    if (!stream) return;

    const socket = get().socket;
    
    // Stop all screen share tracks
    stream.getTracks().forEach(track => track.stop());

    // Remove video track from all peer connections
    const senders = get().screenSenders;
    const pcs = get().peerConnections;

    for (const [socketId, pc] of Object.entries(pcs)) {
      const sender = senders[socketId];
      if (sender && pc.signalingState !== 'closed') {
        try {
          pc.removeTrack(sender);
          
          // Renegotiate connections
          const offer = await pc.createOffer();
          const mungedSDP = preferStereoOpus(offer.sdp);
          const mungedOffer = new RTCSessionDescription({ type: 'offer', sdp: mungedSDP });
          await pc.setLocalDescription(mungedOffer);
          if (socket) {
            socket.emit('send-signal', {
              targetSocketId: socketId,
              signal: { sdp: mungedOffer }
            });
          }
        } catch (err) {
          console.error(`Failed to remove video track from peer ${socketId}:`, err);
        }
      }
    }

    set({
      localScreenStream: null,
      screenSenders: {},
      screenShareOwnerSocketId: null
    });

    if (socket) {
      socket.emit('stop-screen-share');
    }
    console.log('Screen sharing stopped successfully');
  },
}));
