# Choy Card Game

Real-time multiplayer Filipino card, dice & 6×5 cascading slot PWA featuring Tong-its (2P/3P Regular, Butasan, Joker), Pusoy, Lucky 9, Texas Poker, Color Game, Bet Game, Tsekitsa, Super Ace Slots, Admin Control Panel, and Secret Builder Studio.

## Quick Deploy (Render / Docker)

- **Runtime**: Docker (`Dockerfile` included) or Node 22+
- **Build Command** (if using Node runtime): `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check**: `/api/health`
- **Optional Environment Variable**: `GEMINI_API_KEY` (for Ask Choy AI & Admin Secret Studio AI)
