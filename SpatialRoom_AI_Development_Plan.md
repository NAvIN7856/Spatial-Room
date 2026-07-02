# SpatialRoom -- AI Development Plan

## Project Overview

Build a real-time virtual room where users can move, sit, and
communicate using spatial (3D positional) audio. Users hear voices from
the correct direction and volume changes naturally with distance.

## Tech Stack

### Frontend

-   React
-   Vite
-   Tailwind CSS
-   Zustand or Redux
-   Socket.IO Client
-   Mediasoup Client
-   Web Audio API
-   HTML Canvas (Phase 1)
-   Three.js (Optional)
-   Framer Motion

### Backend

-   Node.js
-   Express
-   Socket.IO
-   Mediasoup
-   MongoDB
-   Redis (Optional)

## Features

### Authentication

-   Register/Login
-   Profile
-   Friends
-   Invitations

### Room System

-   Create room
-   Join/Leave room
-   Public/Private
-   Password protection
-   Invite friends
-   Room owner/admin roles

### Avatar

Each user has: - Position (x, y) - Rotation - Avatar - Mic status -
Camera status - Speaking indicator - Sitting status

### Movement

-   WASD
-   Arrow keys
-   Mouse click movement
-   Smooth interpolation
-   Real-time synchronization

### Sitting

-   Click chair
-   Walk to chair
-   Sit
-   Stand

## Spatial Audio

Pipeline:

Microphone ↓ WebRTC (Mediasoup) ↓ Remote MediaStream ↓ MediaStreamSource
↓ PannerNode (HRTF) ↓ Destination

Features: - Left/right/front/back positioning - Distance attenuation -
Smooth movement updates - Voice activity detection - Individual volume
control - Mute/Deafen - Push-to-talk - Echo cancellation - Noise
suppression

## UI

-   Room layout
-   Chairs
-   Tables
-   Whiteboard
-   Chat
-   Screen sharing
-   Emoji reactions

## Backend

-   Express API
-   Socket.IO events
-   Mediasoup SFU
-   MongoDB

Socket events: - Connect - Disconnect - Join room - Leave room - Move -
Sit - Chat - Mic - Camera - Screen share - Whiteboard - Speaking state

## Folder Structure

client/ - components - pages - hooks - stores - services - audio -
room - avatar - chat

server/ - controllers - models - routes - socket - mediasoup - utils

## Development Phases

### Phase 1

-   Authentication
-   Room creation
-   Avatar rendering
-   Position sync

### Phase 2

-   Voice chat with Mediasoup

### Phase 3

-   Spatial audio
-   Directional sound
-   Distance effects

### Phase 4

-   Sitting
-   Whiteboard
-   Chat
-   Reactions

### Phase 5

-   Screen sharing
-   Permissions
-   Performance optimization

## Future Enhancements

-   3D rooms
-   VR/WebXR
-   AI assistants
-   Custom furniture
-   Multi-floor buildings
-   Mobile support
