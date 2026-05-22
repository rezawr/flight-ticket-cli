import os from "node:os";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export interface Snapshot {
  ok: boolean;
  inputUrl: string;
  finalUrl: string;
  title: string;
  bodyText: string;
  htmlPath: string;
  screenshotPath: string;
  mainStatus: number;
  console: string[];
  pageErrors: string[];
  notes: string[];
  error: string;
}

export interface BrowserConfig {
  providerName: string;
  headless: boolean;
  timeoutMs: number;
  slowMoMs: number;
  visiblePauseMs: number;
  failurePauseMs: number;
  cacheRoot: string;
  userDataDir: string;
  captureArtifactsOnSuccess: boolean;
  initialNetworkIdleTimeoutMs: number;
  selectorTimeoutMs: number;
  scrollMaxPasses: number;
  scrollPauseMs: number;
  scrollIdleTimeoutMs: number;
}

export function newBrowserConfig(providerName: string, timeoutMs = envInt("PLAYWRIGHT_TIMEOUT_SECONDS", 60) * 1000): BrowserConfig {
  const cacheRoot = process.env.FLIGHT_TICKET_CACHE_DIR?.trim() || path.join(os.homedir(), ".flight-ticket-cli");
  const slug = providerName.trim().toLowerCase().replace(/\s+/g, "-");

  return {
    providerName,
    headless: envBool("PLAYWRIGHT_HEADLESS", true),
    timeoutMs,
    slowMoMs: envInt("PLAYWRIGHT_SLOWMO_MS", 150),
    visiblePauseMs: envInt("PLAYWRIGHT_VISIBLE_PAUSE_MS", 1200),
    failurePauseMs: envInt("PLAYWRIGHT_FAILURE_PAUSE_MS", 8000),
    cacheRoot,
    userDataDir: process.env.PLAYWRIGHT_PROFILE_DIR?.trim() || path.join(cacheRoot, "playwright-profile", slug),
    captureArtifactsOnSuccess: envBool("FLIGHT_TICKET_CAPTURE_ARTIFACTS", false),
    initialNetworkIdleTimeoutMs: envInt("PLAYWRIGHT_NETWORKIDLE_MS", 1200),
    selectorTimeoutMs: envInt("PLAYWRIGHT_SELECTOR_TIMEOUT_MS", 2000),
    scrollMaxPasses: envInt("PLAYWRIGHT_SCROLL_MAX_PASSES", 18),
    scrollPauseMs: envInt("PLAYWRIGHT_SCROLL_PAUSE_MS", 250),
    scrollIdleTimeoutMs: envInt("PLAYWRIGHT_SCROLL_IDLE_MS", 400)
  };
}

export async function missingReason(): Promise<string> {
  try {
    await import("cloakbrowser");
    return "";
  } catch (error) {
    return `cloakbrowser dependency is missing or failed to load: ${toErrorMessage(error)}`;
  }
}

export async function fetchPage(config: BrowserConfig, url: string): Promise<Snapshot> {
  const reason = await missingReason();
  if (reason) {
    throw new Error(reason);
  }

  const artifactsDir = path.join(config.cacheRoot, "playwright-artifacts");
  await mkdir(artifactsDir, { recursive: true });
  await mkdir(config.userDataDir, { recursive: true });

  const { launchPersistentContext } = await import("cloakbrowser");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const basePath = path.join(artifactsDir, `scrape-${stamp}`);
  const result: Snapshot = {
    ok: false,
    inputUrl: url,
    finalUrl: "",
    title: "",
    bodyText: "",
    htmlPath: "",
    screenshotPath: "",
    mainStatus: 0,
    console: [],
    pageErrors: [],
    notes: [],
    error: ""
  };
  let page: any | undefined;

  const context = await launchPersistentContext({
    userDataDir: config.userDataDir,
    headless: config.headless,
    args: ["--disable-quic"],
    viewport: { width: 1440, height: 1200 }
  });

  try {
    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();

    page.on("console", (msg: any) => {
      result.console.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (error: unknown) => {
      result.pageErrors.push(String(error));
    });
    page.on("response", (response: any) => {
      if (response.url() === page.url() || response.request().isNavigationRequest()) {
        result.notes.push(`response ${response.status()} ${response.url()}`);
      }
    });
    page.on("framenavigated", (frame: any) => {
      if (frame === page.mainFrame()) {
        result.notes.push(`navigated ${frame.url()}`);
      }
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: config.timeoutMs
    });
    result.mainStatus = response?.status() ?? 0;

    if (!config.headless && config.visiblePauseMs > 0) {
      await page.waitForTimeout(config.visiblePauseMs);
    }

    try {
      await page.waitForLoadState("networkidle", { timeout: Math.min(config.initialNetworkIdleTimeoutMs, config.timeoutMs) });
    } catch {
      result.notes.push("networkidle timeout");
    }

    const selectors = [
      '[data-testid*="fare"]',
      '[data-testid*="Fare"]',
      ".fare-card",
      '[class*="fareCard"]',
      '[class*="flight-card"]',
      '[class*="FlightCard"]',
      '[class*="price"]',
      '[class*="Price"]'
    ];

    try {
      const selector = await Promise.any(selectors.map(candidate =>
        page.waitForSelector(candidate, {
          timeout: config.selectorTimeoutMs,
          state: "visible"
        }).then(() => candidate)
      ));
      result.notes.push(`fare element appeared: ${selector}`);
    } catch {
      result.notes.push("fare selector timeout");
    }

    result.bodyText = await autoScrollPage(page, result, config);
    if (!result.bodyText.trim()) {
      result.bodyText = await readBodyText(page);
    }

    result.finalUrl = page.url();
    result.title = await page.title().catch(() => "");
    if (config.captureArtifactsOnSuccess) {
      await captureArtifacts(page, result, basePath);
    }
    result.ok = true;
    return result;
  } catch (error) {
    result.error = toErrorMessage(error);
    if (page) {
      await captureArtifacts(page, result, basePath);
    }
    throw new Error(`CloakBrowser page scrape failed: ${result.error}`);
  } finally {
    await context.close().catch(() => {});
  }
}

export function describeSnapshot(snapshot: Snapshot): string {
  const parts: string[] = [];
  if (snapshot.title) {
    parts.push(`title="${snapshot.title}"`);
  }
  if (snapshot.finalUrl) {
    parts.push(`final_url=${snapshot.finalUrl}`);
  }
  if (snapshot.mainStatus > 0) {
    parts.push(`status=${snapshot.mainStatus}`);
  }
  if (snapshot.screenshotPath) {
    parts.push(`screenshot=${snapshot.screenshotPath}`);
  }
  if (snapshot.htmlPath) {
    parts.push(`html=${snapshot.htmlPath}`);
  }
  if (snapshot.pageErrors.length > 0) {
    parts.push(`page_errors=${snapshot.pageErrors.length}`);
  }
  return parts.length > 0 ? parts.join(", ") : "no CloakBrowser diagnostics captured";
}

async function readBodyText(page: {
  locator(selector: string): { innerText(options?: { timeout?: number }): Promise<string> };
  textContent(selector: string): Promise<string | null>;
}): Promise<string> {
  try {
    return await page.locator("body").innerText({ timeout: 10000 });
  } catch {
    return (await page.textContent("body")) ?? "";
  }
}

async function recordSnapshot(
  page: {
    locator(selector: string): { innerText(options?: { timeout?: number }): Promise<string> };
    textContent(selector: string): Promise<string | null>;
  },
  result: Snapshot,
  seen: Set<string>,
  chunks: string[],
  label: string
): Promise<boolean> {
  const text = (await readBodyText(page)).trim();
  if (!text || seen.has(text)) {
    return false;
  }
  seen.add(text);
  chunks.push(text);
  result.notes.push(`snapshot ${label} lines=${text.split("\n").length}`);
  return true;
}

async function autoScrollPage(page: any, result: Snapshot, config: BrowserConfig): Promise<string> {
  const maxPasses = config.scrollMaxPasses;
  const pauseMs = config.scrollPauseMs;
  const seenSnapshots = new Set<string>();
  const chunks: string[] = [];
  let bottomStablePasses = 0;
  let previousState = "";

  await recordSnapshot(page, result, seenSnapshots, chunks, "initial");

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const before = await page.evaluate(() => {
      const root = document.scrollingElement || document.documentElement || document.body;
      const candidates = [root, ...Array.from(document.querySelectorAll("*")).filter(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return /(auto|scroll)/.test(style.overflowY) &&
          el.scrollHeight > el.clientHeight + 50 &&
          el.clientHeight > 100 &&
          rect.height > 100 &&
          rect.width > 0;
      })];

      const targets: Element[] = [];
      for (const el of candidates) {
        if (!el || targets.includes(el)) {
          continue;
        }
        targets.push(el);
        if (targets.length >= 8) {
          break;
        }
      }

      return targets.map((el, index) => {
        const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
        const top = el.scrollTop;
        el.scrollTo({ top: maxTop, behavior: "instant" as ScrollBehavior });
        return {
          index,
          top,
          height: el.scrollHeight,
          clientHeight: el.clientHeight,
          maxTop,
          atBottom: maxTop <= 0 || top >= maxTop - 4
        };
      });
    });

    result.notes.push(`scroll pass=${pass + 1} targets=${before.length}`);
    await page.waitForTimeout(pauseMs);

    try {
      await page.waitForLoadState("networkidle", { timeout: config.scrollIdleTimeoutMs });
    } catch {
      // best-effort
    }

    const after = await page.evaluate(() => {
      const root = document.scrollingElement || document.documentElement || document.body;
      const candidates = [root, ...Array.from(document.querySelectorAll("*")).filter(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return /(auto|scroll)/.test(style.overflowY) &&
          el.scrollHeight > el.clientHeight + 50 &&
          el.clientHeight > 100 &&
          rect.height > 100 &&
          rect.width > 0;
      })];

      const targets: Element[] = [];
      for (const el of candidates) {
        if (!el || targets.includes(el)) {
          continue;
        }
        targets.push(el);
        if (targets.length >= 8) {
          break;
        }
      }

      return targets.map((el, index) => {
        const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
        return {
          index,
          top: el.scrollTop,
          height: el.scrollHeight,
          clientHeight: el.clientHeight,
          maxTop,
          atBottom: maxTop <= 0 || el.scrollTop >= maxTop - 4
        };
      });
    });

    const state = JSON.stringify(after.map((item: any) => [item.index, item.top, item.height, item.clientHeight]));
    const movedOrGrew = state !== previousState;
    const allAtBottom = after.length > 0 && after.every((item: any) => item.atBottom);

    if ((pass + 1) % 3 === 0 || allAtBottom) {
      await recordSnapshot(page, result, seenSnapshots, chunks, `pass-${pass + 1}`);
    }

    if (allAtBottom && !movedOrGrew) {
      bottomStablePasses += 1;
    } else {
      bottomStablePasses = 0;
    }
    previousState = state;

    if (allAtBottom && bottomStablePasses >= 2) {
      result.notes.push(`scroll reached bottom after ${pass + 1} passes`);
      break;
    }
  }

  await page.waitForTimeout(pauseMs);
  await recordSnapshot(page, result, seenSnapshots, chunks, "final-bottom");
  return chunks.join("\n");
}

async function captureArtifacts(page: any, result: Snapshot, basePath: string): Promise<void> {
  try {
    result.title = result.title || await page.title().catch(() => "");
    result.finalUrl = result.finalUrl || page.url();
    const htmlPath = `${basePath}.html`;
    await writeFile(htmlPath, await page.content(), "utf8");
    result.htmlPath = htmlPath;
  } catch {
    // best-effort
  }

  try {
    const screenshotPath = `${basePath}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshotPath = screenshotPath;
  } catch {
    // best-effort
  }
}

function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  switch (value) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
}

function envInt(key: string, fallback: number): number {
  const value = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
