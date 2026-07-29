import {
  addActivity,
  addMessage,
  broadcast,
  cleanCode,
  gameError,
  getRoom,
  playerMark,
} from "@/lib/game";

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = cleanCode(rawCode);
    const payload = (await request.json()) as {
      playerId?: string;
      body?: string;
    };
    const playerId = payload.playerId ?? "";
    const body =
      typeof payload.body === "string"
        ? payload.body.replace(/\s+/g, " ").trim().slice(0, 280)
        : "";

    if (!body) {
      return Response.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    const room = getRoom(code);
    if (!room) {
      return Response.json({ error: "Room not found." }, { status: 404 });
    }

    const mark = playerMark(room, playerId);
    if (!mark) {
      return Response.json({ error: "Invalid player session." }, { status: 403 });
    }

    const player = room.players[mark]!;
    addMessage(room, player, body);
    addActivity(room, "message", `${player.name} sent a message`);
    broadcast(room);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return gameError(error);
  }
}
