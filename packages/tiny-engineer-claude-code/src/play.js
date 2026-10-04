import { readFileSync } from "node:fs";

// The robot answers once the clip has finished playing.
const PLAY_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * @param {string[]} argv arguments after `play`
 * @returns {{ wavPath?: string, anim?: string, url?: string, error?: string }}
 */
export function parsePlayArgs(argv) {
  /** @type {{ wavPath?: string, anim?: string, url?: string }} */
  const opts = {};
  let animSource;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === "--anim" || arg === "--anim-file" || arg === "--url") {
      if (!value) return { error: `${arg} requires a value` };
      i++;
      if (arg === "--url") {
        opts.url = value;
        continue;
      }
      if (animSource) return { error: "use --anim or --anim-file, not both" };
      animSource = arg;
      try {
        opts.anim = arg === "--anim" ? value : readFileSync(value, "utf8");
      } catch (err) {
        return { error: `cannot read ${value}: ${err.message}` };
      }
      continue;
    }
    if (arg.startsWith("-") || opts.wavPath) return { error: `Unknown argument: ${arg}` };
    opts.wavPath = arg;
  }

  if (!opts.wavPath) return { error: "play needs a WAV file" };

  if (opts.anim !== undefined) {
    try {
      // One header line: drop the whitespace a file or pretty-printed JSON carries.
      opts.anim = JSON.stringify(JSON.parse(opts.anim));
    } catch {
      return { error: "the timeline is not valid JSON" };
    }
  }

  return opts;
}

/**
 * POST a WAV to /play, with the timeline in X-Anim. Resolves with the robot's reply.
 * @param {{ baseUrl: string, wav: Uint8Array, anim?: string, token?: string | null }} request
 * @returns {Promise<{ ok: boolean, status: number, body: string }>}
 */
export async function postPlay({ baseUrl, wav, anim, token }) {
  /** @type {Record<string, string>} */
  const headers = { "Content-Type": "audio/wav" };
  if (anim) headers["X-Anim"] = anim;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/play`, {
    method: "POST",
    headers,
    body: wav,
    signal: AbortSignal.timeout(PLAY_TIMEOUT_MS),
  });

  return { ok: response.ok, status: response.status, body: await response.text() };
}
