#!/usr/bin/env node

import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

const DEFAULT_TIMEOUT_MS = 120_000;

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    values.set(key.slice(2), value);
    index += 1;
  }
  return values;
}

function required(args, name) {
  const value = args.get(name)?.trim();
  if (!value) throw new Error(`Missing required --${name} argument.`);
  return value;
}

function redact(value) {
  return String(value ?? "")
    .replace(/([#?&]token=)[^\s"']+/gi, "$1<REDACTED>")
    .replace(/("?(?:pairUrl|token)"?\s*[:=]\s*"?)[^\s,"'}]+/gi, "$1<REDACTED>")
    .replace(/\s+/g, " ")
    .trim();
}

function errorText(error) {
  return redact(error instanceof Error ? error.message : error).slice(0, 500);
}

function browserCandidates(explicitPath) {
  return [
    explicitPath,
    process.env.T3CODE_BROWSER_PATH,
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/brave-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
}

function findBrowserPath(explicitPath) {
  const selected = browserCandidates(explicitPath).find((candidate) =>
    NodeFS.existsSync(candidate),
  );
  if (!selected) {
    throw new Error(
      "No supported Chromium browser was found. Pass --browser-path or set T3CODE_BROWSER_PATH.",
    );
  }
  return selected;
}

async function waitForDescriptor(webOrigin, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const descriptorUrl = new URL("/.well-known/t3/environment", webOrigin);
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(descriptorUrl, { redirect: "manual" });
      if (response.ok) return await response.json();
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = errorText(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`The dev server never became ready at ${webOrigin}: ${lastError}`);
}

function issuePairingUrl({ repoRoot, baseDir, serverPort, webOrigin }) {
  const output = NodeChildProcess.execFileSync(
    process.execPath,
    [
      "apps/server/src/bin.ts",
      "auth",
      "pairing",
      "create",
      "--base-dir",
      baseDir,
      "--dev-url",
      webOrigin,
      "--base-url",
      webOrigin,
      "--ttl",
      "15m",
      "--label",
      "agent-browser-smoke",
      "--json",
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, T3CODE_PORT: String(serverPort) },
      encoding: "utf8",
      timeout: DEFAULT_TIMEOUT_MS,
      windowsHide: true,
    },
  );
  const issued = JSON.parse(output);
  if (typeof issued.pairUrl !== "string") {
    throw new Error("The pairing command did not return pairUrl JSON.");
  }
  const pairUrl = new URL(issued.pairUrl);
  if (pairUrl.origin !== webOrigin) {
    throw new Error(`The pairing URL origin ${pairUrl.origin} does not match ${webOrigin}.`);
  }
  return pairUrl.toString();
}

async function waitForAppReady(page, timeoutMs) {
  await page.waitForFunction(
    () => {
      const body = document.body?.innerText ?? "";
      const textbox = document.querySelector(
        'textarea, [contenteditable="true"], [role="textbox"]',
      );
      return (
        textbox !== null &&
        !/Loading workspace/i.test(body) &&
        !/Reconnect this environment/i.test(body) &&
        /General chats/i.test(body) &&
        /(What should we build|Ask anything|Ask for follow-up changes)/i.test(body)
      );
    },
    undefined,
    { timeout: timeoutMs },
  );
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const matches = page.locator(selector);
    for (let index = 0; index < (await matches.count()); index += 1) {
      const candidate = matches.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return null;
}

async function assertComposerConnected(page, timeoutMs) {
  const input = await firstVisible(page, [
    "textarea",
    '[contenteditable="true"]',
    '[role="textbox"]',
  ]);
  if (!input) throw new Error("No visible composer textbox was found.");
  if (await input.isDisabled().catch(() => false)) throw new Error("The composer is disabled.");

  await input.fill("browser connection check");
  try {
    await page.waitForFunction(
      () => {
        const action = document.querySelector(
          'button[aria-label="Send message"], button[aria-label="Queue message"]',
        );
        return action instanceof HTMLButtonElement && !action.disabled;
      },
      undefined,
      { timeout: timeoutMs },
    );
  } catch {
    const label = await page
      .locator(
        'button[aria-label="Environment disconnected"], button[aria-label="Connecting"], button[aria-label="Preparing worktree"], button[aria-label="Sending"]',
      )
      .first()
      .getAttribute("aria-label")
      .catch(() => null);
    throw new Error(`The composer did not become send-ready${label ? ` (${label})` : ""}.`);
  } finally {
    await input.fill("").catch(() => undefined);
  }
}

async function openSettingsAndReturn(page, webOrigin, originalPath, timeoutMs) {
  const settings = page.getByRole("button", { name: "Settings", exact: true }).first();
  await settings.waitFor({ state: "visible", timeout: timeoutMs });
  await settings.click();
  await page.waitForFunction(() => window.location.pathname.includes("/settings"), undefined, {
    timeout: timeoutMs,
  });

  await page.goBack({ waitUntil: "commit", timeout: timeoutMs });
  await page.waitForURL((url) => url.origin === webOrigin && url.pathname === originalPath, {
    waitUntil: "commit",
    timeout: timeoutMs,
  });
  await waitForAppReady(page, timeoutMs);
  await assertComposerConnected(page, timeoutMs);
}

async function pairBrowser({ browser, repoRoot, baseDir, serverPort, webOrigin, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  let lastError = "pairing did not start";

  while (Date.now() < deadline) {
    attempts += 1;
    let context;
    try {
      const remainingMs = Math.max(1_000, deadline - Date.now());
      const descriptor = await waitForDescriptor(webOrigin, remainingMs);
      const pairUrl = issuePairingUrl({ repoRoot, baseDir, serverPort, webOrigin });
      context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const attemptTimeoutMs = Math.min(15_000, Math.max(1_000, deadline - Date.now()));
      await page.goto(pairUrl, { waitUntil: "commit", timeout: attemptTimeoutMs });
      await page.waitForURL((url) => url.pathname !== "/pair", {
        waitUntil: "commit",
        timeout: attemptTimeoutMs,
      });
      return { context, page, descriptor, attempts };
    } catch (error) {
      lastError = errorText(error);
      await context?.close().catch(() => undefined);
    }
  }

  throw new Error(`Pairing did not complete before the timeout: ${lastError}`);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = NodePath.resolve(args.get("repo-root") ?? process.cwd());
  const baseDir = NodePath.resolve(required(args, "base-dir"));
  const serverPort = Number.parseInt(required(args, "server-port"), 10);
  const webUrl = new URL(required(args, "web-url"));
  const timeoutMs = Number.parseInt(args.get("timeout-ms") ?? String(DEFAULT_TIMEOUT_MS), 10);
  const browserPath = findBrowserPath(args.get("browser-path"));

  if (!NodePath.isAbsolute(baseDir))
    throw new Error("--base-dir must resolve to an absolute path.");
  if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65535) {
    throw new Error("--server-port must be a valid TCP port.");
  }
  if (webUrl.pathname !== "/" || webUrl.search || webUrl.hash) {
    throw new Error("--web-url must be an origin without a path, query, or fragment.");
  }
  const webOrigin = webUrl.origin;

  const require = NodeModule.createRequire(
    NodePath.join(repoRoot, "apps", "desktop", "package.json"),
  );
  const { chromium } = require("playwright-core");

  const browser = await chromium.launch({
    headless: true,
    executablePath: browserPath,
    args: ["--disable-gpu", "--disable-dev-shm-usage"],
  });
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  let recoveredConnectionErrors = [];
  let route = null;
  let environmentId = null;
  let pairingAttempts = 0;

  try {
    const paired = await pairBrowser({
      browser,
      repoRoot,
      baseDir,
      serverPort,
      webOrigin,
      timeoutMs,
    });
    const { page, descriptor } = paired;
    environmentId = descriptor.environmentId ?? null;
    pairingAttempts = paired.attempts;
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(redact(message.text()).slice(0, 300));
    });
    page.on("pageerror", (error) => pageErrors.push(errorText(error)));
    page.on("requestfailed", (request) => {
      requestFailures.push({
        path: new URL(request.url()).pathname,
        error: redact(request.failure()?.errorText).slice(0, 200),
      });
    });

    await waitForAppReady(page, timeoutMs);
    route = new URL(page.url()).pathname;
    await assertComposerConnected(page, timeoutMs);
    await openSettingsAndReturn(page, webOrigin, route, timeoutMs);

    recoveredConnectionErrors = consoleErrors.filter((message) =>
      /WebSocket connection to .*\/ws.* failed/i.test(message),
    );
    const actionableConsoleErrors = consoleErrors.filter(
      (message) => !recoveredConnectionErrors.includes(message),
    );
    if (actionableConsoleErrors.length || pageErrors.length || requestFailures.length) {
      throw new Error(
        `Browser errors were observed: ${JSON.stringify({ consoleErrors: actionableConsoleErrors, pageErrors, requestFailures })}`,
      );
    }
  } finally {
    await browser.close();
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        environmentId,
        route,
        browser: browserPath,
        pairingAttempts,
        recoveredConnectionErrors,
        checks: [
          "public environment descriptor",
          "single-use JSON pairing",
          "application readiness",
          "composer send readiness",
          "settings round trip",
          "environment reconnection",
          "browser error capture",
        ],
      },
      null,
      2,
    )}\n`,
  );
}

run().catch((error) => {
  process.stderr.write(`${errorText(error)}\n`);
  process.exitCode = 1;
});
