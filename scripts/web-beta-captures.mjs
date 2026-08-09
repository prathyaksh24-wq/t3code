// @effect-diagnostics nodeBuiltinImport:off
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

const DEFAULT_TIMEOUT_MS = 120_000;
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const IDLE_TASK_BUDGET_MS = 1_000;
const STREAMING_TASK_BUDGET_MS = 1_200;
const PERFORMANCE_SAMPLE_COUNT = 3;

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

function redact(value) {
  return String(value ?? "")
    .replace(/([#?&]token=)[^\s"']+/gi, "$1<REDACTED>")
    .replace(/("?(?:pairUrl|token)"?\s*[:=]\s*"?)[^\s,"'}]+/gi, "$1<REDACTED>")
    .replace(/\s+/g, " ")
    .trim();
}

function browserCandidates(explicitPath) {
  return [
    explicitPath,
    process.env.T3CODE_BROWSER_PATH,
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/brave-browser",
    "/usr/bin/chromium",
  ].filter(Boolean);
}

function findBrowserPath(explicitPath) {
  const browserPath = browserCandidates(explicitPath).find((candidate) =>
    NodeFS.existsSync(candidate),
  );
  if (!browserPath) throw new Error("No supported Chromium browser was found.");
  return browserPath;
}

async function waitForDescriptor(webOrigin, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const descriptorUrl = new URL("/.well-known/t3/environment", webOrigin);
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(descriptorUrl);
      if (response.ok) return await response.json();
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = redact(error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`The beta environment did not become ready: ${lastError}`);
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
      "web-beta-captures",
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
  if (typeof issued.pairUrl !== "string") throw new Error("Pairing did not return a URL.");
  const pairUrl = new URL(issued.pairUrl);
  if (pairUrl.origin !== webOrigin)
    throw new Error("Pairing URL origin did not match the web app.");
  return pairUrl.toString();
}

async function waitForApplication(page, timeoutMs) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? "";
      const composer = document.querySelector(
        'textarea, [contenteditable="true"], [role="textbox"]',
      );
      return (
        !/Loading workspace/i.test(text) &&
        !/Reconnect this environment/i.test(text) &&
        (composer !== null || /Providers/i.test(text))
      );
    },
    undefined,
    { timeout: timeoutMs },
  );
}

function readMetric(metrics, name) {
  return metrics.find((metric) => metric.name === name)?.value ?? 0;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function measureContinuousWork(page, label, durationMs, taskBudgetMs) {
  const session = await page.context().newCDPSession(page);
  await session.send("Performance.enable");
  await page.waitForTimeout(750);
  const taskDurationSamplesMs = [];
  const scriptDurationSamplesMs = [];
  for (let sample = 0; sample < PERFORMANCE_SAMPLE_COUNT; sample += 1) {
    const before = await session.send("Performance.getMetrics");
    await page.waitForTimeout(durationMs);
    const after = await session.send("Performance.getMetrics");
    taskDurationSamplesMs.push(
      (readMetric(after.metrics, "TaskDuration") - readMetric(before.metrics, "TaskDuration")) *
        1000,
    );
    scriptDurationSamplesMs.push(
      (readMetric(after.metrics, "ScriptDuration") - readMetric(before.metrics, "ScriptDuration")) *
        1000,
    );
  }
  const taskDurationMs = median(taskDurationSamplesMs);
  const scriptDurationMs = median(scriptDurationSamplesMs);
  const animations = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running")
      .flatMap((animation) => {
        const effect = animation.effect;
        if (!(effect instanceof KeyframeEffect)) return [];
        if (effect.getComputedTiming().iterations !== Number.POSITIVE_INFINITY) return [];
        const properties = Array.from(
          new Set(
            effect
              .getKeyframes()
              .flatMap((frame) => Object.keys(frame))
              .filter(
                (property) =>
                  !["offset", "easing", "composite", "computedOffset"].includes(property),
              ),
          ),
        ).sort();
        return [{ properties }];
      }),
  );
  const repaintingAnimations = animations.filter(({ properties }) =>
    properties.some((property) => property !== "opacity" && property !== "transform"),
  );
  await session.detach();

  if (taskDurationMs > taskBudgetMs) {
    throw new Error(
      `${label} used a median ${taskDurationMs.toFixed(1)}ms of main-thread task time; budget is ${String(taskBudgetMs)}ms; samples were ${taskDurationSamplesMs.map((value) => value.toFixed(1)).join(", ")}ms.`,
    );
  }
  if (repaintingAnimations.length > 0) {
    throw new Error(
      `${label} has continuously repainting animations: ${JSON.stringify(repaintingAnimations)}.`,
    );
  }
  return {
    sampleCount: PERFORMANCE_SAMPLE_COUNT,
    sampleDurationMs: durationMs,
    taskDurationMs: Number(taskDurationMs.toFixed(1)),
    taskDurationSamplesMs: taskDurationSamplesMs.map((value) => Number(value.toFixed(1))),
    scriptDurationMs: Number(scriptDurationMs.toFixed(1)),
    scriptDurationSamplesMs: scriptDurationSamplesMs.map((value) => Number(value.toFixed(1))),
    infiniteCompositorAnimations: animations.length,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = NodePath.resolve(args.get("repo-root") ?? process.cwd());
  const baseDir = NodePath.resolve(required(args, "base-dir"));
  const outputDir = NodePath.resolve(required(args, "output-dir"));
  const serverPort = Number.parseInt(required(args, "server-port"), 10);
  const webUrl = new URL(required(args, "web-url"));
  const timeoutMs = Number.parseInt(args.get("timeout-ms") ?? String(DEFAULT_TIMEOUT_MS), 10);
  const browserPath = findBrowserPath(args.get("browser-path"));
  if (!Number.isInteger(serverPort)) throw new Error("--server-port must be an integer.");
  if (webUrl.pathname !== "/" || webUrl.search || webUrl.hash) {
    throw new Error("--web-url must be an origin without a path, query, or fragment.");
  }
  const webOrigin = webUrl.origin;
  NodeFS.mkdirSync(outputDir, { recursive: true });

  const descriptor = await waitForDescriptor(webOrigin, timeoutMs);
  if (typeof descriptor.environmentId !== "string") {
    throw new Error("Environment descriptor did not include environmentId.");
  }
  const require = NodeModule.createRequire(
    NodePath.join(repoRoot, "apps", "desktop", "package.json"),
  );
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({
    headless: true,
    executablePath: browserPath,
    args: ["--disable-dev-shm-usage"],
  });
  const screenshots = [];
  const browserErrors = [];
  const performance = {};

  try {
    const observePage = (currentPage) => {
      currentPage.on("pageerror", (error) => browserErrors.push(redact(error.message)));
      currentPage.on("console", (message) => {
        if (
          message.type() === "error" &&
          !/WebSocket connection to .*\/ws.* failed/i.test(message.text())
        ) {
          browserErrors.push(redact(message.text()));
        }
      });
    };

    const pairingDeadline = Date.now() + timeoutMs;
    let pairingContext;
    let page;
    let pairingError = "pairing did not start";
    while (Date.now() < pairingDeadline) {
      const candidateContext = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
      const candidatePage = await candidateContext.newPage();
      observePage(candidatePage);
      try {
        const pairUrl = issuePairingUrl({ repoRoot, baseDir, serverPort, webOrigin });
        await candidatePage.goto(pairUrl, { waitUntil: "commit", timeout: 20_000 });
        await candidatePage.waitForURL((url) => url.pathname !== "/pair", {
          waitUntil: "commit",
          timeout: 20_000,
        });
        pairingContext = candidateContext;
        page = candidatePage;
        break;
      } catch (error) {
        pairingError = redact(error instanceof Error ? error.message : error);
        await candidateContext.close();
      }
    }
    if (!pairingContext || !page) {
      throw new Error(`Pairing did not complete before the timeout: ${pairingError}`);
    }
    const saveScreenshot = async (name, scenePage) => {
      const dismissButtons = scenePage.getByRole("button", { name: "Dismiss notification" });
      for (let index = (await dismissButtons.count()) - 1; index >= 0; index -= 1) {
        const dismissButton = dismissButtons.nth(index);
        if (await dismissButton.isVisible()) {
          await dismissButton.click({ force: true, timeout: 2_000 }).catch(() => undefined);
        }
      }
      const screenshotPath = NodePath.join(outputDir, `${name}.png`);
      await scenePage.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push(screenshotPath);
    };

    const activateThread = async (threadId, readyText) => {
      const legacyRow = page.getByTestId(`thread-row-${threadId}`);
      if ((await legacyRow.count()) > 0) {
        await legacyRow.click();
      } else {
        await page
          .locator("[data-thread-item]")
          .filter({ hasText: readyText })
          .first()
          .getByRole("button")
          .first()
          .click();
      }
      await waitForApplication(page, Math.min(timeoutMs, 30_000));
      await page.getByText("Loading chat", { exact: true }).waitFor({
        state: "hidden",
        timeout: 30_000,
      });
      await page
        .locator("[data-chat-header]")
        .getByText(readyText, { exact: false })
        .first()
        .waitFor({ state: "visible", timeout: 30_000 });
      return page;
    };

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await waitForApplication(page, Math.min(timeoutMs, 30_000));
    await saveScreenshot("landing", page);
    const activeScene = await activateThread(
      "remote-command-center",
      "Make remote coding feel local",
    );
    await saveScreenshot("active-chat-and-sidebar", activeScene);
    performance.idle = await measureContinuousWork(
      activeScene,
      "idle active chat",
      4_000,
      IDLE_TASK_BUDGET_MS,
    );

    await activeScene.getByRole("button", { name: "Toggle right panel" }).click();
    const emptyPanelDiff = activeScene.getByRole("button", {
      name: /^Diff Review changes in this thread\./,
    });
    if (await emptyPanelDiff.isVisible()) {
      await emptyPanelDiff.click();
    } else {
      await activeScene.getByRole("button", { name: "Add panel surface" }).click();
      await activeScene.getByRole("menuitem", { name: "Diff" }).click();
    }
    await activeScene
      .getByRole("button", { name: /Diff scope:/ })
      .waitFor({ state: "visible", timeout: 30_000 });
    await saveScreenshot("diff", activeScene);

    await activeScene.getByRole("button", { name: "Toggle terminal drawer" }).click();
    await activeScene
      .getByText("612 tests passed", { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });
    await saveScreenshot("terminal", activeScene);
    await activeScene.getByRole("button", { name: "Toggle terminal drawer" }).click();
    await activeScene.getByRole("button", { name: "Toggle right panel" }).click();

    const streamingScene = await activateThread(
      "buttery-suspense",
      "Make Suspense transitions buttery",
    );
    await saveScreenshot("streaming", streamingScene);
    performance.streaming = await measureContinuousWork(
      streamingScene,
      "streaming chat",
      4_000,
      STREAMING_TASK_BUDGET_MS,
    );
    const permissionScene = await activateThread(
      "pocket-command-center",
      "Put the command center in your pocket",
    );
    await saveScreenshot("permission", permissionScene);

    await page
      .locator('[data-sidebar="footer"]')
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await page.getByRole("button", { name: "Providers", exact: true }).click();
    await page.getByRole("heading", { name: "Providers" }).waitFor({
      state: "visible",
      timeout: 30_000,
    });
    await saveScreenshot("settings", page);

    await page
      .locator('[data-sidebar="footer"]')
      .getByRole("button", { name: "Back", exact: true })
      .click();
    const responsiveScene = await activateThread(
      "remote-command-center",
      "Make remote coding feel local",
    );
    await responsiveScene.setViewportSize(MOBILE_VIEWPORT);
    await saveScreenshot("responsive-chat", responsiveScene);

    if (browserErrors.length > 0) {
      throw new Error(`Browser errors were observed: ${JSON.stringify(browserErrors)}.`);
    }
  } finally {
    await browser.close();
  }

  const report = {
    ok: true,
    environmentId: descriptor.environmentId,
    browser: browserPath,
    screenshots,
    performance,
    checks: [
      "landing page",
      "active chat and sidebar",
      "streaming state",
      "permission state",
      "provider settings",
      "terminal drawer",
      "diff panel",
      "responsive chat",
      "idle main-thread budget",
      "streaming main-thread budget",
      "continuous repaint animation audit",
      "browser error capture",
    ],
  };
  NodeFS.writeFileSync(
    NodePath.join(outputDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

run().catch((error) => {
  process.stderr.write(`${redact(error instanceof Error ? error.message : error)}\n`);
  process.exitCode = 1;
});
