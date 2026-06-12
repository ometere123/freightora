"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ensureGenLayerStudionet, getEthereumProvider } from "./config";

export function makeReadClient() {
  return createClient({ chain: studionet });
}

export function makeWalletClient(account: `0x${string}`) {
  const eth = getEthereumProvider();
  if (!eth) return null;

  return createClient({
    chain: studionet,
    account,
    provider: eth,
  });
}

export async function ensureWalletOnStudionet() {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error(
      "No Web3 wallet found. Install MetaMask or a compatible wallet.",
    );
  }

  await ensureGenLayerStudionet(provider);
}
