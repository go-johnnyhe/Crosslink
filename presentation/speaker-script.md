# TIC//LINK — Speaker Script

Target: 7:00 total, ~3:00 for Q&A after. Times are cumulative — if you're past the mark, skip ahead rather than rushing the current slide.

Before presenting: edit `index.html` — add your name(s) on the title slide, the GitHub link on the last slide, and your team's actual answers on the Reflection slide.

---

**0:00 — Title**
"TIC//LINK is our CS5700 final project — a real-time multiplayer Tic-Tac-Toe game. The point of the project is the networking, not the game rules."

**0:20 — Introduction**
"Two players connect from separate browsers. A Next.js server holds the single copy of the game state — the board, whose turn it is, both players' info. Both browsers read from that server and send their moves to it. That's the whole system."

**0:50 — System Features**
"On the gameplay side: moves sync in real time, there's one shared board, and we track wins, losses, and draws. On the networking side: quick matchmaking or private room codes, in-game chat, and a connection activity log."

**1:30 — System Analysis & Design**
"Both browsers only talk to the server, never to each other. Before any move is applied, the server checks three things: is this actually the player it claims to be, is it their turn, and is the square open. That's the mechanism that guarantees both players see the same board."

**2:25 — Implementation & Methodology**
"The API is Next.js route handlers. The frontend is React with no extra state library. All room data — board, players, chat, activity — lives in one in-memory store, keyed by room code. For sync, the client just requests the room's state over plain HTTP every 850 milliseconds and re-renders. We didn't use WebSockets — for a turn-based game, polling is simpler to build and test, and the latency difference isn't noticeable."

**3:20 — Testing & User Manual**
"We have automated build and lint checks, plus a two-player integration test that creates a room, joins it, plays a full game to a win, checks the score updated, and confirms a rematch resets the board. To run it yourself: clone the repo, `npm ci`, `npm run dev`, then open two browser windows — quick match in both, or create a room and share the code."

**4:05 — Improvements & Future Work**
"Given more time: persistent storage so state survives a restart, WebSockets instead of polling, spectator mode and voice chat, and accounts with stats that persist across sessions."

**4:40 — Conclusion**
"TIC//LINK implements every required feature. The one real tradeoff is in-memory storage — simple, but it means state resets if the server restarts. That was the right call for a project this size."

**5:10 — Reflection**
"[Speak from your own experience here — what actually surprised you, what you'd do differently, what you learned about real-time systems. Don't read a scripted answer; this section is supposed to sound like you.]"

**6:00 — Questions?**
"That's TIC//LINK. Happy to take questions."

---

## Anticipated Q&A

- **Why polling instead of WebSockets?** Simpler to implement and test within scope; 850ms is not noticeable for a turn-based game with no strict latency requirement.
- **What happens if the server restarts?** All rooms are lost — a known limitation, called out in the README.
- **How do you stop a player from moving out of turn?** Every move request is checked server-side against the room's current turn and the caller's identity before it's applied.
- **How do you track wins/losses?** Player stats are stored on the in-memory player object and updated when a round ends with a winner or draw.
