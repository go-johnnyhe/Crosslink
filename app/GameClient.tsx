"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

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

const SESSION_KEY = "crosslink-session";

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
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
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

  // One long-lived Server-Sent Events stream per session. The server pushes a
  // full room snapshot on connect and then only when something changes.
  useEffect(() => {
    if (!session) return;

    const stream = new EventSource(
      `/api/rooms/${session.roomCode}/stream?player=${session.playerId}`,
    );
    let received = false;

    stream.onmessage = (event) => {
      received = true;
      setGame(JSON.parse(event.data) as GameState);
      setLive(true);
    };

    stream.onerror = () => {
      setLive(false);
      // Never connected means the room is gone (usually a server restart), so
      // stop retrying and send the player back to the lobby. After a first
      // successful message, let EventSource reconnect on its own.
      if (!received) {
        stream.close();
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
        setGame(null);
        setError("That room is no longer available.");
      }
    };

    return () => stream.close();
  }, [session]);

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

  // Actions only send. The resulting state arrives back over the stream.
  async function play(index: number) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/rooms/${session.roomCode}/move`, {
        method: "POST",
        body: JSON.stringify({ playerId: session.playerId, index }),
      });
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rematch failed.");
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!session) return;
    void navigator.clipboard.writeText(session.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function leave() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setGame(null);
    setError("");
    setLive(false);
  }

  if (!session) {
    return (
      <main className="lobby">
        <div className="lobby-card">
          <div className="brand">
            <span className="brand-mark">CROSSLINK</span>
            <p>Real-time multiplayer tic-tac-toe</p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void join("quick");
            }}
          >
            <label htmlFor="display-name">Display name</label>
            <input
              id="display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              maxLength={20}
              autoComplete="off"
              required
            />

            <button className="btn primary" type="submit" disabled={busy}>
              Find a match
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => join("create")}
              disabled={busy}
            >
              Create a private room
            </button>

            <div className="rule"><span>or join with a code</span></div>

            <div className="code-row">
              <input
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(event.target.value.toUpperCase())
                }
                placeholder="ABC123"
                maxLength={6}
                autoComplete="off"
                aria-label="Room code"
              />
              <button
                className="btn"
                type="button"
                onClick={() => join("join")}
                disabled={busy}
              >
                Join
              </button>
            </div>

            {error && <p className="error" role="alert">{error}</p>}
          </form>
        </div>
      </main>
    );
  }

  const yourMark = session.mark;
  const opponentMark: Mark = yourMark === "X" ? "O" : "X";
  const opponent = game?.room.players[opponentMark];
  const yourTurn =
    game?.room.status === "playing" && game.room.currentMark === yourMark;
  const voted = game?.room.rematch[yourMark];

  let status = "Connecting";
  if (game?.room.status === "waiting") status = "Waiting for an opponent";
  if (game?.room.status === "playing") {
    status = yourTurn ? "Your turn" : `${opponent?.name || "Opponent"}'s turn`;
  }
  if (game?.room.status === "finished") {
    status =
      game.room.winner === "draw"
        ? "Draw"
        : game.room.winner === yourMark
          ? "You won"
          : `${opponent?.name || "Opponent"} won`;
  }

  return (
    <main className="game">
      <header className="topbar">
        <span className="brand-mark">CROSSLINK</span>
        <div className="topbar-right">
          <button className="chip" type="button" onClick={copyCode}>
            <span className="code">{session.roomCode}</span>
            {copied ? "Copied" : "Copy"}
          </button>
          <span className={`status-dot ${live ? "on" : "off"}`}>
            <i />
            {live ? "Live" : "Reconnecting"}
          </span>
          <button className="btn quiet" type="button" onClick={leave}>
            Leave
          </button>
        </div>
      </header>

      <div className="layout">
        <section className="play">
          <div className="play-head">
            <div>
              <p className="label">Round {game?.room.round || 1}</p>
              <h1>{status}</h1>
            </div>
            <span className={`you mark-${yourMark.toLowerCase()}`}>
              You are {yourMark}
            </span>
          </div>

          <div className="players">
            {(["X", "O"] as Mark[]).map((mark) => {
              const player = game?.room.players[mark];
              const active =
                game?.room.status === "playing" &&
                game.room.currentMark === mark;
              return (
                <div className={`player ${active ? "active" : ""}`} key={mark}>
                  <b className={`mark-${mark.toLowerCase()}`}>{mark}</b>
                  <div>
                    <span>{player?.name || "Waiting"}</span>
                    <small>
                      {player
                        ? `${player.wins}W · ${player.losses}L · ${player.draws}D`
                        : "—"}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="board" role="group" aria-label="Tic-tac-toe board">
            {(game?.room.board || Array(9).fill("")).map((cell, index) => (
              <button
                type="button"
                key={index}
                className={cell ? `mark-${cell.toLowerCase()}` : ""}
                disabled={!yourTurn || Boolean(cell) || busy}
                onClick={() => play(index)}
                aria-label={
                  cell ? `Square ${index + 1}, ${cell}` : `Play square ${index + 1}`
                }
              >
                {cell}
              </button>
            ))}
          </div>

          {game?.room.status === "waiting" && (
            <p className="notice">
              Share code <b>{session.roomCode}</b> to invite your opponent.
            </p>
          )}

          {game?.room.status === "finished" && (
            <button
              className="btn primary wide"
              type="button"
              onClick={rematch}
              disabled={busy || voted}
            >
              {voted ? "Waiting for opponent" : "Play again"}
            </button>
          )}
        </section>

        <aside>
          <section className="panel chat">
            <h2>Chat</h2>
            <div className="messages">
              {!game?.messages.length && <p className="empty">No messages yet.</p>}
              {game?.messages.map((item) => (
                <div
                  className={`bubble ${item.player_id === session.playerId ? "mine" : ""}`}
                  key={item.id}
                >
                  <small>
                    {item.player_id === session.playerId
                      ? "You"
                      : item.sender_name}
                    <time>{formatTime(item.created_at)}</time>
                  </small>
                  <p>{item.body}</p>
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>
            <form onSubmit={sendMessage}>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={opponent ? "Message" : "Waiting for opponent"}
                maxLength={280}
                autoComplete="off"
                disabled={!opponent}
              />
              <button
                className="btn"
                type="submit"
                disabled={!message.trim() || !opponent}
              >
                Send
              </button>
            </form>
          </section>

          <section className="panel activity">
            <h2>Connection activity</h2>
            {!game?.activity.length && <p className="empty">No activity yet.</p>}
            {game?.activity.slice(0, 5).map((item) => (
              <div key={item.id}>
                <span>{item.detail}</span>
                <time>{formatTime(item.created_at)}</time>
              </div>
            ))}
          </section>
        </aside>
      </div>

      {error && (
        <button className="toast" type="button" onClick={() => setError("")}>
          {error}
          <span aria-hidden="true">×</span>
        </button>
      )}
    </main>
  );
}
