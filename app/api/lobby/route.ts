import {
  cleanCode,
  cleanName,
  createPlayer,
  createRoom,
  findWaitingRoom,
  gameError,
  getRoom,
  joinRoom,
} from "@/lib/game";

type LobbyRequest = {
  action?: "quick" | "create" | "join";
  name?: string;
  code?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LobbyRequest;
    const action = payload.action ?? "quick";
    const name = cleanName(payload.name);

    if (name.length < 2) {
      return Response.json(
        { error: "Enter a display name with at least 2 characters." },
        { status: 400 },
      );
    }

    const player = createPlayer(name);
    let room;

    if (action === "join") {
      const code = cleanCode(payload.code);
      if (code.length !== 6) {
        return Response.json(
          { error: "Enter a valid 6-character room code." },
          { status: 400 },
        );
      }

      room = getRoom(code);
      if (!room) {
        return Response.json({ error: "Room not found." }, { status: 404 });
      }
      if (!joinRoom(room, player)) {
        return Response.json(
          { error: "That room already has two players." },
          { status: 409 },
        );
      }
    } else if (action === "quick") {
      room = findWaitingRoom();
      if (!room || !joinRoom(room, player)) room = createRoom(player);
    } else {
      room = createRoom(player);
    }

    const mark = room.players.X.id === player.id ? "X" : "O";
    return Response.json(
      {
        session: {
          roomCode: room.code,
          playerId: player.id,
          name,
          mark,
        },
        status: room.status,
      },
      { status: 201 },
    );
  } catch (error) {
    return gameError(error);
  }
}
