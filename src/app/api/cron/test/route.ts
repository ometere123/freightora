import { NextResponse } from "next/server";
import { createPublicClient, http, defineChain, encodeFunctionData } from "viem";

const RPC_URL = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api";
const CONTRACT = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS ?? "";

const studionet = defineChain({
  id: 61999,
  name: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const ABI = [
  {
    name: "get_config",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export async function GET() {
  const results: Record<string, unknown> = {
    contract: CONTRACT,
    rpc: RPC_URL,
  };

  // Test 1: raw fetch eth_call
  try {
    const selector = encodeFunctionData({ abi: ABI, functionName: "get_config" });
    const raw = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "eth_call",
        params: [{ to: CONTRACT, data: selector }, "latest"],
        id: 1,
      }),
    });
    const json = await raw.json();
    results.raw_rpc = json;
  } catch (e) {
    results.raw_rpc_error = e instanceof Error ? e.message : String(e);
  }

  // Test 2: viem readContract
  try {
    const client = createPublicClient({ chain: studionet, transport: http() });
    const val = await client.readContract({
      address: CONTRACT as `0x${string}`,
      abi: ABI,
      functionName: "get_config",
    });
    results.viem_result = val;
  } catch (e) {
    results.viem_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results);
}
