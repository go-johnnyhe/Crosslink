# TIC//LINK — Speaker Script

Target: 7:00 total, ~3:00 for Q&A after. Times are cumulative — if you're past the mark, skip ahead rather than rushing the current slide.

Before presenting: edit `index.html` — add your name(s) on the title slide, the GitHub link on the last slide, and your team's actual answers on the Reflection slide.

---

**0:00 — Title**
"TIC//LINK is our CS5700 final project — a real-time multiplayer Tic-Tac-Toe game. The point of the project is the networking, not the game rules."

**0:20 — Introduction**
"Two players connect from separate browsers. A Next.js server holds the single copy of the game state — the board, whose turn it is, both players' info. Both browsers read from that server and send their moves to it."

**0:50 — System Features**
"On the gameplay side: moves sync in real time, there's one shared board, and we track wins, losses, and draws. On the networking side: quick matchmaking or private room codes, in-game chat, and a connection activity log."

**1:30 — System Analysis & Design**
"Both browsers only talk to the server, never to each other. Before any move is applied, the server checks three things: is this the player it claims to be, is it their turn, and is the square open. That's what guarantees both players see the same board. Moves go up as ordinary POST requests; state comes back down over an open stream."

**2:20 — Implementation & Methodology**
"The API is Next.js route handlers. The frontend is React with no extra state library. All room data lives in one in-memory store keyed by room code. For synchronization, each player holds one long-lived Server-Sent Events connection — the server pushes a full room snapshot when something changes, and nothing at all when the room is idle."

**3:05 — Transport Choice** *(the measurement slide)*
"This is the part we're most glad we measured. Our first working version polled the server every 850 milliseconds for the complete room state. It met the requirements, but when we actually measured the payload we found an empty room cost 753 bytes, a room with ten chat messages cost 3.5 KB, and once the message history filled up it hit 27 KB — and we were re-sending that over and over even when both players were just sitting there thinking. That's roughly 8 to 62 kilobytes a second per room to transmit nothing new.

So we looked at WebSockets, and then rejected them. Our traffic is almost entirely one-directional — the server pushes far more than the clients send — and WebSockets would have meant writing our own reconnection and heartbeat logic. Server-Sent Events gave us what we actually needed: zero bytes while idle, 39 milliseconds measured delivery, and automatic reconnection built into the browser."

**4:05 — Testing & User Manual**
"We verified it by running two browsers side by side and playing full games — checking that both boards stayed identical, that out-of-turn moves and taken squares were rejected, and that chat, wins, draws, and rematches all worked. To run it: clone the repo, `npm ci`, `npm run dev`, then open two browser windows."

**4:45 — Improvements & Future Work**
"Given more time: persistent storage so state survives a restart, WebSockets if the game ever needed a busy upward channel, spectator mode, and accounts with stats that persist."

**5:15 — Conclusion**
"TIC//LINK implements every required feature. The one real tradeoff left is in-memory storage — simple, but state resets if the server restarts. That was the right call at this size."

**5:40 — Reflection**
"[Speak from your own experience here — what actually surprised you, what you'd do differently, what you learned. Don't read a scripted answer; this section should sound like you.]"

**6:15 — Questions?**
"That's TIC//LINK. Happy to take questions."

---

## Anticipated Q&A

- **Why not WebSockets?** Our traffic is ~95% server-to-client, so full-duplex would have gone mostly unused, and WebSockets require hand-written reconnection and heartbeat logic. SSE is push-based over plain HTTP and `EventSource` reconnects automatically. If the upward channel ever got busy, WebSockets would be the right upgrade.
- **Is SSE actually used in production?** Yes — it's the mechanism most LLM APIs use to stream tokens to a browser.
- **How is this "real-time" if it's HTTP?** SSE is one HTTP request the server never closes, so it can push at any moment. We measured 39 ms from one player's click to the other player's board updating.
- **What happens if the connection drops?** `EventSource` reconnects on its own, and the server sends a full snapshot on connect, so a reconnecting client is immediately correct again.
- **What happens if the server restarts?** All rooms are lost, and clients are returned to the lobby. A known limitation, called out in the README.
- **How do you stop a player from moving out of turn?** Every move is checked server-side against the room's current turn and the caller's identity before it's applied.
- **Why full snapshots instead of just the change?** A snapshot is self-healing — any client that receives one is fully correct, so we never have to reconstruct state from a partial event history. At this size the payload is small enough that it isn't worth the extra complexity.
