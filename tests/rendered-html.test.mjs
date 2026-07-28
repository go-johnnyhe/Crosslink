import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the TIC//LINK lobby contains the required interface", async () => {
  const [clientSource, layout] = await Promise.all([
    readFile(new URL("../app/GameClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /TIC\/\/LINK/);
  assert.match(clientSource, /REAL-TIME MULTIPLAYER/);
  assert.match(clientSource, /OWN THE GRID\./);
  assert.match(clientSource, /Quick match/);
  assert.match(clientSource, /Connection activity/);
});

test("the project stays focused on the game", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /GameClient/);
  assert.match(layout, /TIC\/\/LINK/);
  assert.match(layout, /Real-time network Tic-Tac-Toe/);
});

test("the local server owns the shared room state", async () => {
  const gameStore = await readFile(new URL("../lib/game.ts", import.meta.url), "utf8");
  assert.match(gameStore, /rooms: Map/);
  assert.match(gameStore, /getWinner/);
  assert.match(gameStore, /addMessage/);
  assert.match(gameStore, /addActivity/);
});
