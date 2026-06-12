"use client";

import { openDB } from "idb";

const DB = "freightora-drafts";
const STORE = "case-drafts";

async function db() {
  return openDB(DB, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: "case_id" });
      }
    },
  });
}

export async function saveDraft(draft: Record<string, unknown> & { case_id: string }) {
  const d = await db();
  await d.put(STORE, { ...draft, _saved: Date.now() });
}

export async function getDraft(caseId: string) {
  const d = await db();
  return d.get(STORE, caseId);
}

export async function listDrafts() {
  const d = await db();
  return d.getAll(STORE);
}

export async function deleteDraft(caseId: string) {
  const d = await db();
  await d.delete(STORE, caseId);
}
