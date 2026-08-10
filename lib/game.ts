import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export type Mark = "X" | "O";
export type Cell = Mark | "";

export type NetworkInfo = {
  address: string;
  edge: string;
};

export type Player = {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  games_played: number;
  network: NetworkInfo;
};

export type Message = {
  id: number;
  player_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

export type Activity = {
  id: number;
  event_type: string;
  detail: string;
  created_at: string;
};

export type Room = {
  code: string;
  status: "waiting" | "playing" | "finished";
  board: Cell[];
  currentMark: Mark;
  winner: Mark | "draw" | null;
  players: { X: Player; O: Player | null };
  rematch: Record<Mark, boolean>;
  round: number;
  messages: Message[];
  activity: Activity[];
  createdAt: number;
};

type GameStore = {
  rooms: Map<string, Room>;
  nextId: number;
};

const appGlobal = globalThis as typeof globalThis & {
  ticLinkStore?: GameStore;
};

const activityLogPath =
  process.env.ACTIVITY_LOG_PATH ?? join(process.cwd(), "data", "activity.jsonl");

// globalThis keeps the same store when Next.js reloads route modules in development.
export const store =
  appGlobal.ticLinkStore ??
  (appGlobal.ticLinkStore = { rooms: new Map(), nextId: 1 });

function timestamp() {
  return new Date().toISOString();
}

export function cleanName(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, 20)
    : "";
}

export function cleanCode(value: unknown) {
  return typeof value === "string"
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
    : "";
}

export function networkInfo(request: Request): NetworkInfo {
  const address = request.headers.get("cf-connecting-ip") ?? "direct";
  const parts = address.split(".");
  const maskedAddress =
    parts.length === 4
      ? `${parts[0]}.${parts[1]}.x.x`
      : address.includes(":")
        ? `${address.split(":").slice(0, 3).join(":")}::/48`
        : "direct";

  return {
    address: maskedAddress,
    edge: request.headers.get("cf-ray")?.split("-").at(-1) ?? "local",
  };
}

export function createPlayer(name: string, network: NetworkInfo): Player {
  return {
    id: crypto.randomUUID(),
    name,
    wins: 0,
    losses: 0,
    draws: 0,
    games_played: 0,
    network,
  };
}

export function createRoom(player: Player) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  do {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  } while (store.rooms.has(code));

  const room: Room = {
    code,
    status: "waiting",
    board: Array<Cell>(9).fill(""),
    currentMark: "X",
    winner: null,
    players: { X: player, O: null },
    rematch: { X: false, O: false },
    round: 1,
    messages: [],
    activity: [],
    createdAt: Date.now(),
  };

  store.rooms.set(code, room);
  addActivity(room, "room_created", `${player.name} opened room ${code}`);
  return room;
}

export function getRoom(code: string) {
  return store.rooms.get(code);
}

export function findWaitingRoom() {
  return [...store.rooms.values()]
    .filter((room) => room.status === "waiting")
    .sort((a, b) => a.createdAt - b.createdAt)[0];
}

export function joinRoom(room: Room, player: Player) {
  if (room.status !== "waiting" || room.players.O) return false;
  room.players.O = player;
  room.status = "playing";
  addActivity(room, "player_joined", `${player.name} joined room ${room.code}`);
  return true;
}

export function playerMark(room: Room, playerId: string): Mark | null {
  if (room.players.X.id === playerId) return "X";
  if (room.players.O?.id === playerId) return "O";
  return null;
}

export function addActivity(room: Room, eventType: string, detail: string) {
  const activity = {
    id: store.nextId++,
    event_type: eventType,
    detail,
    created_at: timestamp(),
  };

  room.activity.unshift(activity);
  room.activity = room.activity.slice(0, 20);

  mkdirSync(dirname(activityLogPath), { recursive: true });
  appendFileSync(
    activityLogPath,
    `${JSON.stringify({
      created_at: activity.created_at,
      room_code: room.code,
      event_type: activity.event_type,
      detail: activity.detail,
    })}\n`,
  );
}

export function addMessage(room: Room, player: Player, body: string) {
  room.messages.push({
    id: store.nextId++,
    player_id: player.id,
    sender_name: player.name,
    body,
    created_at: timestamp(),
  });
  room.messages = room.messages.slice(-60);
}

export function getWinner(board: Cell[]): Mark | "draw" | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Mark;
    }
  }
  return board.every(Boolean) ? "draw" : null;
}

// --- Live updates -----------------------------------------------------------
// Every open Server-Sent Events stream registers a listener for its room. When
// a route mutates a room it calls broadcast(), which pushes one snapshot to
// both players. Nothing is sent while a room is idle.

type Listener = (payload: string) => void;

const listenerGlobal = globalThis as typeof globalThis & {
  ticLinkListeners?: Map<string, Set<Listener>>;
};

const listeners =
  listenerGlobal.ticLinkListeners ??
  (listenerGlobal.ticLinkListeners = new Map<string, Set<Listener>>());

// The snapshot both players receive. Identical for everyone in the room, so it
// is serialized once per broadcast.
export function roomView(room: Room) {
  return {
    room: {
      code: room.code,
      status: room.status,
      board: room.board,
      currentMark: room.currentMark,
      winner: room.winner,
      round: room.round,
      rematch: room.rematch,
      players: room.players,
    },
    messages: room.messages,
    activity: room.activity,
  };
}

export function subscribe(code: string, listener: Listener) {
  const room = listeners.get(code) ?? new Set<Listener>();
  room.add(listener);
  listeners.set(code, room);

  return () => {
    room.delete(listener);
    if (room.size === 0) listeners.delete(code);
  };
}

export function broadcast(room: Room) {
  const subscribers = listeners.get(room.code);
  if (!subscribers?.size) return;

  const payload = JSON.stringify(roomView(room));
  for (const listener of subscribers) listener(payload);
}

export function gameError(error: unknown) {
  console.error(error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
