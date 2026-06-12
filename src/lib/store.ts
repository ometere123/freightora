"use client";

import { create } from "zustand";
import { getAddress } from "viem";

interface WalletStore {
  account: `0x${string}` | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useWallet = create<WalletStore>((set) => ({
  account: null,
  connecting: false,

  connect: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (window as any).ethereum as { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } | undefined;
    if (!eth) {
      alert("No Web3 wallet found. Install MetaMask or a compatible wallet.");
      return;
    }
    set({ connecting: true });
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" }) as string[];
      if (accounts[0]) {
        set({ account: getAddress(accounts[0]) });
        // Switch to GenLayer Studionet (chain 61999 = 0xF21F)
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xF21F" }],
          });
        } catch (switchErr) {
          // 4902 = chain not added yet — add it
          const code = (switchErr as { code?: number })?.code;
          if (code === 4902) {
            try {
              await eth.request({
                method: "wallet_addEthereumChain",
                params: [{
                  chainId: "0xF21F",
                  chainName: "GenLayer Studionet",
                  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
                  rpcUrls: ["https://studio.genlayer.com/api"],
                  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
                }],
              });
            } catch {
              // user dismissed add — not fatal
            }
          }
          // any other error (user rejected switch) — not fatal
        }
      }
    } catch {
      // user rejected account request
    } finally {
      set({ connecting: false });
    }
  },

  disconnect: () => set({ account: null }),
}));

// Silently restore already-connected account on page load (no MetaMask popup)
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = (window as any).ethereum as { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } | undefined;
  if (eth) {
    eth.request({ method: "eth_accounts" }).then((accounts) => {
      const list = accounts as string[];
      if (list[0]) useWallet.setState({ account: getAddress(list[0]) });
    }).catch(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (eth as any).on?.("accountsChanged", (accounts: string[]) => {
      useWallet.setState({ account: accounts[0] ? getAddress(accounts[0]) : null });
    });
  }
}
