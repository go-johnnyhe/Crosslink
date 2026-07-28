export type Mark = "X" | "O";
export type Cell = Mark | "";

export type Player = {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  games_played: number;
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

export function createPlayer(name: string): Player {
  return {
    id: crypto.randomUUID(),
    name,
    wins: 0,
    losses: 0,
    draws: 0,
    games_played: 0,
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
  room.activity.unshift({
    id: store.nextId++,
    event_type: eventType,
    detail,
    created_at: timestamp(),
  });
  room.activity = room.activity.slice(0, 20);
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

export function gameError(error: unknown) {
  console.error(error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
