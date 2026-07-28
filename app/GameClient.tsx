"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Mark = "X" | "O";

type Session = {
  roomCode: string;
  playerId: string;
  name: string;
  mark: Mark;
};

type Player = {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
};

type Message = {
  id: number;
  player_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

type Activity = {
  id: number;
  event_type: string;
  detail: string;
  created_at: string;
};

type GameState = {
  room: {
    code: string;
    status: "waiting" | "playing" | "finished";
    board: Array<"" | Mark>;
    currentMark: Mark;
    winner: Mark | "draw" | null;
    round: number;
    rematch: Record<Mark, boolean>;
    players: Record<Mark, Player | null>;
  };
  messages: Message[];
  activity: Activity[];
};

const SESSION_KEY = "tic-link-session";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ""
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function GameClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return;
    try {
      // Restoring browser-only session data requires a client-side effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(JSON.parse(stored));
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const syncGame = useCallback(async () => {
    if (!session) return;
    const started = performance.now();
    try {
      const data = await request<GameState>(
        `/api/rooms/${session.roomCode}?player=${session.playerId}`,
      );
      setGame(data);
      setLatency(Math.round(performance.now() - started));
    } catch {
      // Keep the current board visible during a temporary connection failure.
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    // Start the first network sync as soon as a session becomes available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncGame();
    const timer = window.setInterval(syncGame, 850);
    return () => window.clearInterval(timer);
  }, [session, syncGame]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [game?.messages.length]);

  async function join(action: "quick" | "create" | "join") {
    setBusy(true);
    setError("");
    try {
      const data = await request<{ session: Session }>("/api/lobby", {
        method: "POST",
        body: JSON.stringify({ action, name, code: roomCode }),
      });
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.session));
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  }

  async function play(index: number) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/rooms/${session.roomCode}/move`, {
        method: "POST",
        body: JSON.stringify({ playerId: session.playerId, index }),
      });
      await syncGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!session || !message.trim()) return;
    const text = message;
    setMessage("");
    try {
      await request(`/api/rooms/${session.roomCode}/message`, {
        method: "POST",
        body: JSON.stringify({ playerId: session.playerId, body: text }),
      });
      await syncGame();
    } catch (err) {
      setMessage(text);
      setError(err instanceof Error ? err.message : "Message failed.");
    }
  }

  async function rematch() {
    if (!session) return;
    setBusy(true);
    try {
      await request(`/api/rooms/${session.roomCode}/rematch`, {
        method: "POST",
        body: JSON.stringify({ playerId: session.playerId }),
      });
      await syncGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rematch failed.");
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setGame(null);
    setError("");
  }

  if (!session) {
    return (
      <main className="lobby">
        <header className="topbar">
          <strong>TIC//LINK</strong>
          <span><i /> NETWORK ONLINE</span>
        </header>

        <section className="lobby-content">
          <div className="intro">
            <p className="eyebrow">REAL-TIME MULTIPLAYER</p>
            <h1>OWN THE GRID.</h1>
            <p>
              Play synchronized Tic-Tac-Toe with a friend or match with the next
              available player.
            </p>
          </div>

          <form
            className="join-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void join("quick");
            }}
          >
            <h2>Join a game</h2>
            <label>
              Display name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                maxLength={20}
                required
              />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              Quick match
            </button>
            <button type="button" onClick={() => join("create")} disabled={busy}>
              Create private room
            </button>
            <div className="join-code">
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                placeholder="Room code"
                maxLength={6}
                aria-label="Room code"
              />
              <button type="button" onClick={() => join("join")} disabled={busy}>
                Join
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <small>No account required.</small>
          </form>
        </section>
      </main>
    );
  }

  const yourMark = session.mark;
  const opponentMark: Mark = yourMark === "X" ? "O" : "X";
  const opponent = game?.room.players[opponentMark];
  const yourTurn =
    game?.room.status === "playing" && game.room.currentMark === yourMark;
  const voted = game?.room.rematch[yourMark];

  let status = "Connecting…";
  if (game?.room.status === "waiting") status = "Waiting for another player";
  if (game?.room.status === "playing") {
    status = yourTurn ? "Your turn" : `${opponent?.name || "Opponent"}'s turn`;
  }
  if (game?.room.status === "finished") {
    status =
      game.room.winner === "draw"
        ? "Draw"
        : game.room.winner === yourMark
          ? "You won!"
          : `${opponent?.name || "Opponent"} won`;
  }

  return (
    <main className="game">
      <header className="topbar">
        <strong>TIC//LINK</strong>
        <div className="room-info">
          Room <b>{session.roomCode}</b>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(session.roomCode)}
          >
            Copy
          </button>
          <span><i /> {latency ?? "—"} ms</span>
          <button type="button" onClick={leave}>Exit</button>
        </div>
      </header>

      <div className="game-layout">
        <section className="play-area">
          <div className="game-heading">
            <div>
              <p className="eyebrow">ROUND {game?.room.round || 1}</p>
              <h1>{status}</h1>
            </div>
            <span className={`mark-badge mark-${yourMark.toLowerCase()}`}>
              YOU ARE {yourMark}
            </span>
          </div>

          <div className="players">
            {(["X", "O"] as Mark[]).map((mark) => {
              const player = game?.room.players[mark];
              return (
                <div className={game?.room.currentMark === mark ? "active" : ""} key={mark}>
                  <b className={`mark-${mark.toLowerCase()}`}>{mark}</b>
                  <span>{player?.name || "Waiting…"}</span>
                  <small>{player ? `${player.wins}W ${player.losses}L ${player.draws}D` : "—"}</small>
                </div>
              );
            })}
          </div>

          <div className="board" role="grid" aria-label="Tic-Tac-Toe board">
            {(game?.room.board || Array(9).fill("")).map((cell, index) => (
              <button
                type="button"
                role="gridcell"
                key={index}
                className={cell ? `mark-${cell.toLowerCase()}` : ""}
                disabled={!yourTurn || Boolean(cell) || busy}
                onClick={() => play(index)}
                aria-label={cell || `Play square ${index + 1}`}
              >
                {cell}
              </button>
            ))}
          </div>

          {game?.room.status === "waiting" && (
            <p className="notice">
              Share room code <b>{session.roomCode}</b> with the second player.
            </p>
          )}

          {game?.room.status === "finished" && (
            <button className="primary rematch" onClick={rematch} disabled={busy || voted}>
              {voted ? "Waiting for opponent…" : "Play again"}
            </button>
          )}
        </section>

        <aside>
          <section className="panel chat">
            <h2>Game chat</h2>
            <div className="messages">
              {!game?.messages.length && <p className="empty">No messages yet.</p>}
              {game?.messages.map((item) => (
                <div className={item.player_id === session.playerId ? "mine" : ""} key={item.id}>
                  <small>{item.player_id === session.playerId ? "You" : item.sender_name} · {formatTime(item.created_at)}</small>
                  <p>{item.body}</p>
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>
            <form onSubmit={sendMessage}>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type a message"
                maxLength={280}
                disabled={!opponent}
              />
              <button type="submit" disabled={!message.trim() || !opponent}>Send</button>
            </form>
          </section>

          <section className="panel activity">
            <h2>Connection activity</h2>
            {!game?.activity.length && <p className="empty">No activity yet.</p>}
            {game?.activity.slice(0, 6).map((item) => (
              <div key={item.id}>
                <span>{item.detail}</span>
                <time>{formatTime(item.created_at)}</time>
              </div>
            ))}
          </section>
        </aside>
      </div>

      {error && <button className="toast" onClick={() => setError("")}>{error} ×</button>}
    </main>
  );
}
