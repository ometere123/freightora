export const GENLAYER_STUDIONET = {
  name: "GenLayer Studionet",
  chainId: 61999,
  rpcUrl: "https://studio.genlayer.com/api",
  currency: "GEN",
  explorerUrl: "https://explorer-studio.genlayer.com/",
} as const;

export const genlayerConfig = {
  networkName:
    process.env.NEXT_PUBLIC_GENLAYER_NETWORK_NAME ?? GENLAYER_STUDIONET.name,
  chainId: Number(
    process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID ?? GENLAYER_STUDIONET.chainId,
  ),
  rpcUrl:
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? GENLAYER_STUDIONET.rpcUrl,
  explorerUrl:
    process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL ??
    GENLAYER_STUDIONET.explorerUrl,
  currency:
    process.env.NEXT_PUBLIC_GENLAYER_CURRENCY ?? GENLAYER_STUDIONET.currency,
  contractAddress:
    process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS?.trim() ?? "",
} as const;

export const genlayerHexChainId = `0x${genlayerConfig.chainId
  .toString(16)
  .toUpperCase()}`;

export type EthereumRequestArgs = {
  method: string;
  params?: unknown[];
};

export type EthereumProvider = {
  request: (args: EthereumRequestArgs) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

export async function ensureGenLayerStudionet(provider: EthereumProvider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: genlayerHexChainId }],
    });
    return;
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code !== 4902) throw error;
  }

  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: genlayerHexChainId,
        chainName: genlayerConfig.networkName,
        nativeCurrency: {
          name: genlayerConfig.currency,
          symbol: genlayerConfig.currency,
          decimals: 18,
        },
        rpcUrls: [genlayerConfig.rpcUrl],
        blockExplorerUrls: [genlayerConfig.explorerUrl],
      },
    ],
  });

  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: genlayerHexChainId }],
  });
}

export const isContractConfigured = Boolean(genlayerConfig.contractAddress);

export const CONTRACT_NOT_CONFIGURED =
  "GenLayer contract is not configured yet. Deploy Freightora and add NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS to enable live cargo exception resolution.";
