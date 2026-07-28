import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  return { response, data };
}

test("two players can create, join, chat, and synchronize a move", async () => {
  const alphaResult = await request("/api/lobby", {
    method: "POST",
    body: JSON.stringify({ action: "create", name: "Alpha" }),
  });
  assert.equal(alphaResult.response.status, 201);
  const alpha = alphaResult.data.session;
  assert.equal(alpha.mark, "X");
  assert.match(alpha.roomCode, /^[A-Z2-9]{6}$/);

  const betaResult = await request("/api/lobby", {
    method: "POST",
    body: JSON.stringify({
      action: "join",
      name: "Beta",
      code: alpha.roomCode,
    }),
  });
  assert.equal(betaResult.response.status, 201);
  const beta = betaResult.data.session;
  assert.equal(beta.mark, "O");

  const invalidTurn = await request(`/api/rooms/${alpha.roomCode}/move`, {
    method: "POST",
    body: JSON.stringify({ playerId: beta.playerId, index: 0 }),
  });
  assert.equal(invalidTurn.response.status, 409);
  assert.match(invalidTurn.data.error, /your turn/i);

  const move = await request(`/api/rooms/${alpha.roomCode}/move`, {
    method: "POST",
    body: JSON.stringify({ playerId: alpha.playerId, index: 4 }),
  });
  assert.equal(move.response.status, 200);
  assert.equal(move.data.board[4], "X");

  const message = await request(`/api/rooms/${alpha.roomCode}/message`, {
    method: "POST",
    body: JSON.stringify({
      playerId: beta.playerId,
      body: "Good opening move.",
    }),
  });
  assert.equal(message.response.status, 201);

  const state = await request(
    `/api/rooms/${alpha.roomCode}?player=${encodeURIComponent(beta.playerId)}`,
  );
  assert.equal(state.response.status, 200);
  assert.equal(state.data.room.status, "playing");
  assert.equal(state.data.room.board[4], "X");
  assert.equal(state.data.room.currentMark, "O");
  assert.equal(state.data.room.players.X.name, "Alpha");
  assert.equal(state.data.room.players.O.name, "Beta");
  assert.equal(state.data.messages.at(-1).body, "Good opening move.");
  assert.ok(state.data.activity.length >= 3);

  const remainingMoves = [
    [beta.playerId, 0],
    [alpha.playerId, 1],
    [beta.playerId, 2],
    [alpha.playerId, 7],
  ];
  for (const [playerId, index] of remainingMoves) {
    const result = await request(`/api/rooms/${alpha.roomCode}/move`, {
      method: "POST",
      body: JSON.stringify({ playerId, index }),
    });
    assert.equal(result.response.status, 200);
  }

  const finished = await request(
    `/api/rooms/${alpha.roomCode}?player=${encodeURIComponent(alpha.playerId)}`,
  );
  assert.equal(finished.data.room.status, "finished");
  assert.equal(finished.data.room.winner, "X");
  assert.equal(finished.data.room.players.X.wins, 1);
  assert.equal(finished.data.room.players.O.losses, 1);

  const alphaRematch = await request(`/api/rooms/${alpha.roomCode}/rematch`, {
    method: "POST",
    body: JSON.stringify({ playerId: alpha.playerId }),
  });
  assert.equal(alphaRematch.response.status, 200);

  const betaRematch = await request(`/api/rooms/${alpha.roomCode}/rematch`, {
    method: "POST",
    body: JSON.stringify({ playerId: beta.playerId }),
  });
  assert.equal(betaRematch.response.status, 200);

  const rematch = await request(
    `/api/rooms/${alpha.roomCode}?player=${encodeURIComponent(beta.playerId)}`,
  );
  assert.equal(rematch.data.room.status, "playing");
  assert.equal(rematch.data.room.round, 2);
  assert.deepEqual(rematch.data.room.board, Array(9).fill(""));
});
