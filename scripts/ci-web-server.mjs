#!/usr/bin/env node

import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

const STOP_GRACE_PERIOD_MS = 15_000;
const STOP_FORCE_PERIOD_MS = 5_000;
// oxlint-disable-next-line t3code/no-global-process-runtime -- Standalone CI launcher has no Effect runtime.
const hostPlatform = NodeOS.platform();

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Invalid argument near ${key ?? "end of command"}.`);
    }
    args.set(key.slice(2), value);
    index += 1;
  }
  return args;
}

function required(args, name) {
  const value = args.get(name)?.trim();
  if (!value) throw new Error(`Missing required --${name} argument.`);
  return value;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sendSignal(child, signal) {
  if (!child.pid || child.exitCode !== null) return;
  if (hostPlatform === "win32") {
    child.kill(signal);
    return;
  }

  // The child is a detached process-group leader. Signalling the group also
  // stops the Vite+ and backend children created by dev-runner.
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

const args = parseArgs(process.argv.slice(2));
const baseDir = NodePath.resolve(required(args, "base-dir"));
const logPath = NodePath.resolve(required(args, "log-path"));
const repoRoot = process.cwd();
NodeFS.mkdirSync(NodePath.dirname(logPath), { recursive: true });

const log = NodeFS.createWriteStream(logPath, { flags: "a" });
const child = NodeChildProcess.spawn(
  process.execPath,
  ["scripts/dev-runner.ts", "dev", "--home-dir", baseDir],
  {
    cwd: repoRoot,
    detached: hostPlatform !== "win32",
    env: { ...process.env, T3CODE_NO_BROWSER: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

child.stdout?.pipe(log, { end: false });
child.stderr?.pipe(log, { end: false });

const childExit = new Promise((resolve) => {
  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    resolve(result);
  };
  child.once("error", (error) => {
    log.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    finish({ code: 1, signal: null });
  });
  child.once("exit", (code, signal) => finish({ code, signal }));
});

let stopping = false;

async function stopChild() {
  if (stopping || child.exitCode !== null) return;
  stopping = true;

  sendSignal(child, "SIGINT");
  const graceful = await Promise.race([
    childExit.then(() => true),
    wait(STOP_GRACE_PERIOD_MS).then(() => false),
  ]);
  if (graceful) return;

  sendSignal(child, "SIGTERM");
  const terminated = await Promise.race([
    childExit.then(() => true),
    wait(STOP_FORCE_PERIOD_MS).then(() => false),
  ]);
  if (terminated) return;

  sendSignal(child, "SIGKILL");
  await childExit;
}

process.once("SIGINT", () => {
  void stopChild();
});
process.once("SIGTERM", () => {
  void stopChild();
});

const result = await childExit;
log.end();
if (result.code !== 0) {
  process.exitCode = result.code ?? 1;
}
