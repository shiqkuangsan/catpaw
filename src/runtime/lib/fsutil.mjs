import { appendFile, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const LOCK_STALE_MS = 60_000;

export async function writeAtomic(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temp, "w");
  try {
    await handle.writeFile(text);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

export async function appendText(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, text);
}

// A lock is stale when its holder process is gone, or when it is older than
// any read-modify-write could take. Commands never hold it while running checks.
async function staleLock(file) {
  try {
    const [text, info] = await Promise.all([readFile(file, "utf8"), stat(file)]);
    const pid = Number(text.trim());
    if (pid > 0) {
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code === "ESRCH") return true;
      }
    }
    return Date.now() - info.mtimeMs > LOCK_STALE_MS;
  } catch (error) {
    return error.code === "ENOENT";
  }
}

export async function withLock(file, fn, { timeoutMs = 15_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (let delay = 5; ; delay = Math.min(delay * 2, 200)) {
    try {
      const handle = await open(file, "wx");
      await handle.writeFile(`${process.pid}\n`);
      await handle.close();
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (await staleLock(file)) {
        await rm(file, { force: true });
        continue;
      }
      if (Date.now() > deadline) {
        throw Object.assign(new Error(`Board is locked by another catpaw process (${file}).`), { code: "ERR_LOCKED" });
      }
      await sleep(delay);
    }
  }
  try {
    return await fn();
  } finally {
    await rm(file, { force: true });
  }
}
