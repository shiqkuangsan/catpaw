import { appendFile, mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";

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
