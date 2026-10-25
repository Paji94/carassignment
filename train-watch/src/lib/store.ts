import { promises as fs } from "fs";
import path from "path";
import type { OdakyuStatus } from "./odakyuStatus";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "subscriptions.json");
const STATE_FILE = path.join(DATA_DIR, "state.json");

export interface StoredPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  registeredAt: string;
}

export interface AppState {
  currentStatus: OdakyuStatus | null;
  /** 最後に通知を送った状態を識別するキー（同じ遅延で連投しないための重複排除用） */
  lastNotifiedKey: string | null;
  lastCheckedAt: string | null;
}

const DEFAULT_STATE: AppState = {
  currentStatus: null,
  lastNotifiedKey: null,
  lastCheckedAt: null,
};

let writeQueue: Promise<unknown> = Promise.resolve();

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const task = writeQueue.then(async () => {
    await ensureDataDir();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export async function getSubscriptions(): Promise<StoredPushSubscription[]> {
  return readJsonFile(SUBSCRIPTIONS_FILE, []);
}

export async function addSubscription(sub: StoredPushSubscription): Promise<void> {
  const subs = await getSubscriptions();
  if (subs.some((s) => s.endpoint === sub.endpoint)) return;
  subs.push(sub);
  await writeJsonFile(SUBSCRIPTIONS_FILE, subs);
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const subs = await getSubscriptions();
  const next = subs.filter((s) => s.endpoint !== endpoint);
  await writeJsonFile(SUBSCRIPTIONS_FILE, next);
}

export async function removeSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const subs = await getSubscriptions();
  const next = subs.filter((s) => !endpoints.includes(s.endpoint));
  await writeJsonFile(SUBSCRIPTIONS_FILE, next);
}

export async function getState(): Promise<AppState> {
  return readJsonFile(STATE_FILE, DEFAULT_STATE);
}

export async function setState(state: AppState): Promise<void> {
  await writeJsonFile(STATE_FILE, state);
}
