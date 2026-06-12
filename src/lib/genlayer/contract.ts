"use client";

import { makeReadClient, makeWalletClient } from "./client";
import { genlayerConfig, isContractConfigured, CONTRACT_NOT_CONFIGURED } from "./config";

function addr(): `0x${string}` {
  if (!isContractConfigured) throw new Error(CONTRACT_NOT_CONFIGURED);
  return genlayerConfig.contractAddress as `0x${string}`;
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readFn(functionName: string, args: any[] = []): Promise<unknown> {
  const client = makeReadClient();
  try {
    return await client.readContract({ address: addr(), functionName, args });
  } catch (e) {
    throw extractError(e);
  }
}

function extractError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (typeof e === "object" && e !== null) {
    const o = e as Record<string, unknown>;
    const msg =
      (typeof o.message === "string" && o.message) ||
      (typeof o.reason === "string" && o.reason) ||
      (typeof o.details === "string" && o.details) ||
      (typeof o.shortMessage === "string" && o.shortMessage) ||
      (typeof o.data === "string" && o.data) ||
      JSON.stringify(e, null, 2);
    return new Error(msg || "Unknown SDK error");
  }
  return new Error(String(e) || "Unknown error");
}

async function writeFn(
  account: `0x${string}`,
  functionName: string,
  args: unknown[],
  value: bigint = BigInt(0),
): Promise<unknown> {
  const client = makeWalletClient(account);
  if (!client) throw new Error("No wallet found. Install MetaMask and connect it to GenLayer Studionet.");
  try {
    await client.connect("studionet");
  } catch (e) {
    // network switch rejected or already on correct chain — continue anyway
    console.warn("[writeFn] connect() warning:", e);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      address: addr(),
      functionName,
      args,
    };
    if (value > BigInt(0)) params.value = value;
    return await client.writeContract(params);
  } catch (e) {
    throw extractError(e);
  }
}

// ── Views ──────────────────────────────────────────────────────────────────

export const getCase = (id: string) =>
  readFn("get_case", [id]).then(parseJson);

export const getReview = (caseId: string) =>
  readFn("get_review", [caseId]).then(parseJson);

export const getResponse = (id: string) =>
  readFn("get_response", [id]).then(parseJson);

export const getEvidence = (id: string) =>
  readFn("get_evidence", [id]).then(parseJson);

export const getExplanation = (id: string) =>
  readFn("get_explanation", [id]).then(parseJson);

export const getSettlement = (id: string) =>
  readFn("get_settlement", [id]).then(parseJson);

export const getReconsideration = (id: string) =>
  readFn("get_reconsideration", [id]).then(parseJson);

export const getReconsiderationReview = (id: string) =>
  readFn("get_reconsideration_review", [id]).then(parseJson);

export const getProtocolStats = () =>
  readFn("get_protocol_stats").then(parseJson);

export const getConfig = () =>
  readFn("get_config").then(parseJson);

export const listCases = (offset = 0, limit = 20) => listAllCases(offset, limit);

export async function listAllCases(offset = 0, limit = 200): Promise<string[]> {
  const raw = await readFn("list_cases", [String(offset), String(limit)]);
  const p = parseJson(raw);
  return Array.isArray(p) ? p : [];
}

export async function getPartyCases(party: string): Promise<string[]> {
  const raw = await readFn("get_party_cases", [party]);
  const p = parseJson(raw);
  return Array.isArray(p) ? p : [];
}

function parseIds(raw: unknown): string[] {
  const p = parseJson(raw);
  return Array.isArray(p) ? (p as string[]) : [];
}

async function fetchByIds<T>(ids: string[], fetch: (id: string) => Promise<unknown>): Promise<T[]> {
  const results = await Promise.allSettled(ids.map(fetch));
  return results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value as T] : []));
}

export async function getResponsesForCase(caseId: string) {
  const ids = parseIds(await readFn("get_responses_for_case", [caseId]));
  return fetchByIds(ids, getResponse);
}

export async function getEvidenceForCase(caseId: string) {
  const ids = parseIds(await readFn("get_evidence_for_case", [caseId]));
  return fetchByIds(ids, getEvidence);
}

export async function getExplanationsForCase(caseId: string) {
  const ids = parseIds(await readFn("get_explanations_for_case", [caseId]));
  return fetchByIds(ids, getExplanation);
}

export async function getSettlementsForCase(caseId: string) {
  const ids = parseIds(await readFn("get_settlements_for_case", [caseId]));
  return fetchByIds(ids, getSettlement);
}

export async function getReconsiderationsForCase(caseId: string) {
  const ids = parseIds(await readFn("get_reconsiderations_for_case", [caseId]));
  return fetchByIds(ids, getReconsideration);
}

// ── Writes ─────────────────────────────────────────────────────────────────

export const openCase = (
  account: `0x${string}`,
  caseId: string,
  caseJson: string,
) => writeFn(account, "open_case", [caseId, caseJson]);

export const submitResponse = (
  account: `0x${string}`,
  responseId: string,
  caseId: string,
  responseJson: string,
) => writeFn(account, "submit_response", [responseId, caseId, responseJson]);

export const addEvidence = (
  account: `0x${string}`,
  evidenceId: string,
  caseId: string,
  evidenceJson: string,
) => writeFn(account, "add_evidence", [evidenceId, caseId, evidenceJson]);

export const submitExplanation = (
  account: `0x${string}`,
  explanationId: string,
  caseId: string,
  explanationJson: string,
) => writeFn(account, "submit_explanation", [explanationId, caseId, explanationJson]);

export const markReadyForReview = (
  account: `0x${string}`,
  caseId: string,
) => writeFn(account, "mark_ready_for_review", [caseId]);

export const REVIEW_FEE = BigInt("10000000000000000");

export const reviewException = (
  account: `0x${string}`,
  caseId: string,
  feeWei: bigint = REVIEW_FEE,
) => writeFn(account, "review_exception", [caseId], feeWei);

export const reviewReconsideration = (
  account: `0x${string}`,
  reconsiderationId: string,
  feeWei: bigint = REVIEW_FEE,
) => writeFn(account, "review_reconsideration", [reconsiderationId], feeWei);

export const openSettlementPath = (
  account: `0x${string}`,
  settlementId: string,
  caseId: string,
  settlementJson: string,
) => writeFn(account, "open_settlement_path", [settlementId, caseId, settlementJson]);

export const acceptSettlement = (
  account: `0x${string}`,
  settlementId: string,
  acceptanceJson: string = "{}",
) => writeFn(account, "accept_settlement", [settlementId, acceptanceJson]);

export const openReconsideration = (
  account: `0x${string}`,
  reconsiderationId: string,
  caseId: string,
  reconsiderationJson: string,
) => writeFn(account, "open_reconsideration", [reconsiderationId, caseId, reconsiderationJson]);

export const finalizeCase = (
  account: `0x${string}`,
  caseId: string,
  note: string,
) => writeFn(account, "finalize_case", [caseId, note]);

export const cancelCase = (
  account: `0x${string}`,
  caseId: string,
  reason: string,
) => writeFn(account, "cancel_case", [caseId, reason]);

export const addResolver = (
  account: `0x${string}`,
  resolver: string,
) => writeFn(account, "add_resolver", [resolver]);

export const removeResolver = (
  account: `0x${string}`,
  resolver: string,
) => writeFn(account, "remove_resolver", [resolver]);

export const pauseProtocol = (account: `0x${string}`) =>
  writeFn(account, "pause_protocol", []);

export const unpauseProtocol = (account: `0x${string}`) =>
  writeFn(account, "unpause_protocol", []);

export const setReviewFee = (account: `0x${string}`, feeWei: string) =>
  writeFn(account, "set_review_fee", [feeWei]);

export const getOwner = () =>
  readFn("get_owner").then((r) => (typeof r === "string" ? r : ""));

export const isResolverAddress = (address: string) =>
  readFn("is_resolver_address", [address]).then((r) => r === "true");
