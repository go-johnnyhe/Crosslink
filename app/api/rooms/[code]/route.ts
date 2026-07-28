import { cleanCode, gameError, getRoom, playerMark } from "@/lib/game";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = cleanCode(rawCode);
    const playerId = new URL(request.url).searchParams.get("player") ?? "";
    const room = getRoom(code);

    if (!room) {
      return Response.json({ error: "Room not found." }, { status: 404 });
    }

    const mark = playerMark(room, playerId);
    if (!mark) {
      return Response.json(
        { error: "This player session is not part of the room." },
        { status: 403 },
      );
    }

    return Response.json({
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
      you: { playerId, mark },
      messages: room.messages,
      activity: room.activity,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return gameError(error);
  }
}
