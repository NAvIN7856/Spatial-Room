# Spatial Room -- Product & UI/UX Master Plan

## Vision

Create a premium **Spatial Audio Room** platform where users naturally
communicate based on their position in a virtual space. The experience
should feel like being in a real room rather than a traditional voice
call.

**Design inspiration** - Linear → clean dashboards - Discord → voice
controls - Apple Vision Pro → floating glass UI - Around → meeting
experience - Arc Browser → polished interactions

------------------------------------------------------------------------

# Core Principle

> The **user never moves on screen**.

The user's avatar is always fixed at the bottom-center.

When the user changes position: - Rotate the **entire room** - Keep the
user fixed - Rotate every participant around the user - Spatial audio
updates based on the new relative angle

This creates a stable mental model.

------------------------------------------------------------------------

# Room Layout

                Alex

          Emma        John

                 You

If You move left:

                Emma

          John        Alex

                 You

------------------------------------------------------------------------

# Spatial Audio

## Distance

-   Closer = louder
-   Farther = quieter

## Direction

-   Left → left ear
-   Right → right ear
-   Front → centered
-   Behind → muffled/spatialized

## Smooth movement

-   No teleporting
-   Animate movement over 300--500ms

------------------------------------------------------------------------

# UI Layout

     ----------------------------------------------------------
    | Sidebar |                 Room                | Members  |
    |         |                                     |          |
    |         |                                     |          |
    |         |             Floating Avatars        | Chat     |
    |         |                                     |          |
     ----------------------------------------------------------
    |            Floating Control Dock              |
     ----------------------------------------------------------

------------------------------------------------------------------------

# Avatar System

Each avatar includes: - Profile image - Speaking ring - Online status -
Distance label (optional) - Hover card - Smooth floating animation

Speaking state: - Pulse ring - Glow - Audio wave - Soft shadow increase

------------------------------------------------------------------------

# Room Themes

-   Coffee Shop ☕
-   Campfire 🔥
-   Office 🏢
-   Study Room 📚
-   Forest 🌲
-   Beach 🏖️
-   Space Station 🚀
-   Podcast Studio 🎙️
-   Gaming Room 🎮

Each theme changes: - Background - Ambient sound - Lighting - Accent
colors

------------------------------------------------------------------------

# Visual Effects

-   Animated radial gradients
-   Noise texture
-   Floating particles
-   Glassmorphism panels
-   Soft shadows
-   20px corner radius
-   Thin borders

------------------------------------------------------------------------

# Distance Rings

    ──────────────
    ────────
    ────
    YOU

Each ring = configurable distance.

------------------------------------------------------------------------

# Compass

          N

    W          E

         YOU

          S

Highlight the direction of active speakers.

------------------------------------------------------------------------

# Mini Map

Small draggable map showing every participant. Dragging updates the
user's position and rotates the room.

------------------------------------------------------------------------

# Control Dock

Floating dock: - 🎤 Mute - 🎧 Spatial Audio - 📹 Camera - 🖥 Share
Screen - ✋ Raise Hand - 💬 Chat - ⚙ Settings - 🚪 Leave

------------------------------------------------------------------------

# Chat

-   Emoji reactions
-   Mentions
-   GIFs
-   Voice notes
-   File sharing
-   Threaded replies
-   Markdown support

------------------------------------------------------------------------

# Participant Panel

Display: - Avatar - Name - Mic status - Camera status - Distance -
Ping - Speaking indicator

------------------------------------------------------------------------

# Motion

Use Framer Motion.

Animations: - Hover scale - Room rotation - Avatar float - Speaking
pulse - Fade transitions - Spring movement - Smooth page transitions

Duration: 200--300ms

------------------------------------------------------------------------

# UX Rules

-   Keep the user fixed.
-   Rotate the room, never the camera.
-   Maintain orientation consistency.
-   Never abruptly move participants.
-   Every interaction should animate.

------------------------------------------------------------------------

# Accessibility

-   Keyboard shortcuts
-   Screen-reader labels
-   High-contrast mode
-   Motion reduction option
-   Large click targets

------------------------------------------------------------------------

# Tech Stack

Frontend - React - Tailwind CSS - DaisyUI - Framer Motion - Lucide
React - React Query - Zustand/Redux

Realtime - Socket.IO - Mediasoup - WebRTC

Backend - Node.js - Express - MongoDB

------------------------------------------------------------------------

# Future Features

## AI

-   Live transcription
-   Meeting summaries
-   Voice activity analytics
-   AI moderator
-   Noise suppression

## Social

-   Friend system
-   Invite links
-   Public rooms
-   Private rooms
-   Clubs

## Gamification

-   XP
-   Badges
-   Themes
-   Seasonal events

------------------------------------------------------------------------

# Premium Feel Checklist

-   Clean typography (Inter)
-   8px spacing grid
-   Floating controls
-   Glass cards
-   Soft gradients
-   Consistent iconography
-   Dark-first UI
-   Minimal clutter
-   Smooth micro-interactions
-   Stable spatial orientation

------------------------------------------------------------------------

# Ultimate Goal

Build an application that feels like a combination of:

-   Linear (clean productivity)
-   Discord (voice communication)
-   Around (meeting experience)
-   Apple Vision Pro (depth and floating UI)
-   Spotify (audio visualization)

The result should feel like users are **sharing the same physical
space**, not simply participating in a voice call.
