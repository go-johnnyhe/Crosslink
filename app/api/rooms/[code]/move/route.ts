import {
  addActivity,
  cleanCode,
  gameError,
  getRoom,
  getWinner,
  playerMark,
} from "@/lib/game";

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = cleanCode(rawCode);
    const { playerId = "", index } = (await request.json()) as {
      playerId?: string;
      index?: number;
    };
    const room = getRoom(code);

    if (!room) {
      return Response.json({ error: "Room not found." }, { status: 404 });
    }

    const mark = playerMark(room, playerId);
    if (!mark) {
      return Response.json({ error: "Invalid player session." }, { status: 403 });
    }
    if (room.status !== "playing") {
      return Response.json({ error: "This round is not active." }, { status: 409 });
    }
    if (room.currentMark !== mark) {
      return Response.json({ error: "Wait for your turn." }, { status: 409 });
    }
    if (!Number.isInteger(index) || index! < 0 || index! > 8) {
      return Response.json({ error: "Invalid board position." }, { status: 400 });
    }
    if (room.board[index!]) {
      return Response.json({ error: "That square is already taken." }, { status: 409 });
    }

    room.board[index!] = mark;
    room.winner = getWinner(room.board);
    room.currentMark = mark === "X" ? "O" : "X";

    if (room.winner) {
      room.status = "finished";
      const playerX = room.players.X;
      const playerO = room.players.O!;
      playerX.games_played += 1;
      playerO.games_played += 1;

      if (room.winner === "draw") {
        playerX.draws += 1;
        playerO.draws += 1;
      } else {
        const winner = room.players[room.winner]!;
        const loser = room.players[room.winner === "X" ? "O" : "X"]!;
        winner.wins += 1;
        loser.losses += 1;
      }
    }

    addActivity(
      room,
      room.winner ? "round_finished" : "move",
      room.winner === "draw"
        ? `Round ${room.round} ended in a draw`
        : room.winner
          ? `${mark} won round ${room.round}`
          : `${mark} claimed square ${index! + 1}`,
    );

    return Response.json({
      ok: true,
      board: room.board,
      winner: room.winner,
    });
  } catch (error) {
    return gameError(error);
  }
}
