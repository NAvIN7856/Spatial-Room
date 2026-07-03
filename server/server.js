import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import { socketProtect, protect } from './middleware/auth.js';
import { setupSocket } from './socket/socketHandler.js';

// Controller imports
import { registerUser, loginUser, getUserProfile } from './controllers/authController.js';
import { createRoom, getRooms, deleteRoom, verifyRoomPassword } from './controllers/roomController.js';

// Resolve directory paths in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// --- REST API ROUTES ---

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Authentication Router
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);
app.get('/api/auth/profile', protect, getUserProfile);

// Room Router
app.post('/api/rooms', protect, createRoom);
app.get('/api/rooms', protect, getRooms);
app.delete('/api/rooms/:id', protect, deleteRoom);
app.post('/api/rooms/:id/verify', protect, verifyRoomPassword);

// --- SOCKET.IO SETUP ---

const io = new Server(httpServer, {
  cors: corsOptions,
});

// Apply JWT authentication middleware to socket connections
io.use(socketProtect);

// Initialize Socket event handlers
setupSocket(io);

// Serve static assets in production (if configured)
// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static(path.join(__dirname, '../client/dist')));
//   app.get('*', (req, res) => {
//     res.sendFile(path.resolve(__dirname, '../client', 'dist', 'index.html'));
//   });
// }
app.get("/", (req, res) => {
  res.json({
    message: "Spatial Room API is running",
    status: "OK",
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
