import {
  addActivity,
  broadcast,
  cleanCode,
  gameError,
  getRoom,
  networkInfo,
  playerMark,
  roomView,
  subscribe,
} from "@/lib/game";

type RouteContext = { params: Promise<{ code: string }> };

// Streaming responses must never be statically optimized.
export const dynamic = "force-dynamic";

async function streamRoom(request: Request, context: RouteContext) {
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

    const network = networkInfo(request);
    room.players[mark]!.network = network;
    addActivity(
      room,
      "client_connected",
      `${mark} connected via ${network.address} (${network.edge})`,
    );
    broadcast(room);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let open = true;

        const write = (text: string) => {
          if (!open) return;
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            open = false;
          }
        };

        // Send the current state immediately so a new or reconnecting client is
        // correct straight away, then only on change.
        write(`data: ${JSON.stringify(roomView(room))}\n\n`);
        const unsubscribe = subscribe(code, (payload) =>
          write(`data: ${payload}\n\n`),
        );

        // Comment lines keep proxies from timing the idle stream out.
        const keepAlive = setInterval(() => write(": keepalive\n\n"), 25000);

        request.signal.addEventListener("abort", () => {
          open = false;
          clearInterval(keepAlive);
          unsubscribe();
          addActivity(room, "client_disconnected", `${mark} disconnected`);
          broadcast(room);
          try {
            controller.close();
          } catch {
            // Already closed by the runtime.
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return gameError(error);
  }
}

// POST avoids response buffering on account-less Cloudflare Quick Tunnels.
export const GET = streamRoom;
export const POST = streamRoom;
