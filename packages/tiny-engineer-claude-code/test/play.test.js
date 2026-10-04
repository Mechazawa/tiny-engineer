import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePlayArgs, postPlay } from "../src/play.js";

test("a timeline file is squashed onto one header line", () => {
  const dir = mkdtempSync(join(tmpdir(), "te-claude-code-play-"));
  const file = join(dir, "dance.json");
  writeFileSync(file, '[\n  ["preset", "typing"],\n  ["sleep", 500]\n]\n');

  assert.deepEqual(parsePlayArgs(["clip.wav", "--anim-file", file]), {
    wavPath: "clip.wav",
    anim: '[["preset","typing"],["sleep",500]]',
  });
});

test("play rejects bad arguments before contacting the robot", () => {
  assert.equal(parsePlayArgs(["--anim", "[]"]).error, "play needs a WAV file");
  assert.equal(parsePlayArgs(["clip.wav", "--anim", "[[\"sleep\""]).error, "the timeline is not valid JSON");
  assert.equal(
    parsePlayArgs(["clip.wav", "--anim", "[]", "--anim-file", "x.json"]).error,
    "use --anim or --anim-file, not both",
  );
  assert.equal(parsePlayArgs(["a.wav", "b.wav"]).error, "Unknown argument: b.wav");
});

test("postPlay streams the WAV with the timeline and token headers", async () => {
  let received;
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      received = { url: req.url, headers: req.headers, body: Buffer.concat(chunks) };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true,"played_ms":10}');
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const reply = await postPlay({
      baseUrl: `http://127.0.0.1:${port}/`,
      wav: Buffer.from("RIFFdata"),
      anim: '[["blink"]]',
      token: "secret",
    });

    assert.deepEqual(reply, { ok: true, status: 200, body: '{"ok":true,"played_ms":10}' });
    assert.equal(received.url, "/play");
    assert.equal(received.headers["x-anim"], '[["blink"]]');
    assert.equal(received.headers.authorization, "Bearer secret");
    assert.equal(received.body.toString(), "RIFFdata");
  } finally {
    server.close();
  }
});
