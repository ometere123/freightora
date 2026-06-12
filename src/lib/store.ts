"use client";

import { create } from "zustand";
import { getAddress } from "viem";
import {
  ensureGenLayerStudionet,
  getEthereumProvider,
} from "@/lib/genlayer/config";

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
    const eth = getEthereumProvider();
    if (!eth) {
      alert("No Web3 wallet found. Install MetaMask or a compatible wallet.");
      return;
    }

    set({ connecting: true });
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts[0]) return;

      await ensureGenLayerStudionet(eth);
      set({ account: getAddress(accounts[0]) });
    } catch {
      // user rejected account or network request
    } finally {
      set({ connecting: false });
    }
  },

  disconnect: () => set({ account: null }),
}));

if (typeof window !== "undefined") {
  const eth = getEthereumProvider();
  if (eth) {
    eth.request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list[0]) useWallet.setState({ account: getAddress(list[0]) });
      })
      .catch(() => {});

    eth.on?.("accountsChanged", (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      useWallet.setState({
        account: accounts[0] ? getAddress(accounts[0]) : null,
      });
    });
  }
}
