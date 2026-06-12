"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export function makeReadClient() {
  return createClient({ chain: studionet });
}

export function makeWalletClient(account: `0x${string}`) {
  if (typeof window === "undefined") return null;
  const eth = (window as { ethereum?: unknown }).ethereum;
  if (!eth) return null;
  return createClient({
    chain: studionet,
    account,
    provider: eth,
  });
}
