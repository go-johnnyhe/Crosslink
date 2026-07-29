import {
  addActivity,
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
    const { playerId = "" } = (await request.json()) as { playerId?: string };
    const room = getRoom(code);

    if (!room) {
      return Response.json({ error: "Room not found." }, { status: 404 });
    }

    const mark = playerMark(room, playerId);
    if (!mark) {
      return Response.json({ error: "Invalid player session." }, { status: 403 });
    }
    if (room.status !== "finished") {
      return Response.json(
        { error: "Finish the current round first." },
        { status: 409 },
      );
    }

    room.rematch[mark] = true;
    addActivity(room, "rematch_vote", `${mark} requested a rematch`);

    if (room.rematch.X && room.rematch.O) {
      room.board.fill("");
      room.status = "playing";
      room.currentMark = "X";
      room.winner = null;
      room.rematch = { X: false, O: false };
      room.round += 1;
      addActivity(room, "round_started", `Round ${room.round} started`);
    }

    broadcast(room);

    return Response.json({ ok: true });
  } catch (error) {
    return gameError(error);
  }
}
