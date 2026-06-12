import { NextRequest, NextResponse } from "next/server";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api";
const CONTRACT = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`;

// viem chain def for the wallet transport
const studionetViem = defineChain({
  id: 61999,
  name: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

function parseJson<T>(raw: unknown): T | null {
  if (typeof raw !== "string" || !raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

interface CaseData {
  case_id: string;
  status: string;
  last_reconsideration_id?: string;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const privateKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    return NextResponse.json({ error: "ADMIN_PRIVATE_KEY not set" }, { status: 500 });
  }

  const account = privateKeyToAccount(privateKey);

  // Read client — genlayer-js, no provider needed
  const readClient = createClient({ chain: studionet });

  // EIP-1193 provider backed by viem wallet + public transport
  const viemWallet = createWalletClient({ account, chain: studionetViem, transport: http() });
  const viemPublic = createPublicClient({ chain: studionetViem, transport: http() });

  const eip1193Provider = {
    request: async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") {
        return [account.address];
      }
      if (method === "eth_chainId") {
        return "0xf21f"; // 61999
      }
      if (method === "eth_sendTransaction") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = (params as any[])[0] as Record<string, unknown>;
        return viemWallet.sendTransaction({
          ...(tx as Parameters<typeof viemWallet.sendTransaction>[0]),
          // Force EIP-1559 (type 2) — GenLayer rejects legacy type-0 raw txs
          type: "eip1559",
          maxFeePerGas: 0n,
          maxPriorityFeePerGas: 0n,
          gasPrice: undefined,
        });
      }
      // Forward everything else to the public transport
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (viemPublic as any).request({ method, params });
    },
  };

  // Write client — genlayer-js with our EIP-1193 provider
  const writeClient = createClient({
    chain: studionet,
    account: account.address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: eip1193Provider as any,
  });

  let step = "init";
  try {
    // Get review fee
    step = "get_config";
    const configRaw = await readClient.readContract({
      address: CONTRACT, functionName: "get_config", args: [],
    });
    const config = parseJson<{ review_fee: string }>(configRaw);
    const fee = BigInt(config?.review_fee ?? "10000000000000000");

    // List all case IDs
    step = "list_cases";
    const idsRaw = await readClient.readContract({
      address: CONTRACT, functionName: "list_cases", args: ["0", "200"],
    });
    step = "parse_ids";
    const ids = parseJson<string[]>(idsRaw);
    if (!ids?.length) {
      return NextResponse.json({ triggered: 0, message: "No cases found" });
    }

    // Fetch each case status
    step = "fetch_cases";
    const caseResults = await Promise.allSettled(
      ids.map((id) =>
        readClient.readContract({ address: CONTRACT, functionName: "get_case", args: [id] })
          .then((r) => parseJson<CaseData>(r))
      )
    );
    const cases = caseResults.flatMap((r) =>
      r.status === "fulfilled" && r.value ? [r.value] : []
    );

    const reviewReady = cases.filter((c) => c.status === "READY_FOR_REVIEW");
    const reconReady = cases.filter((c) => c.status === "READY_FOR_RECONSIDERATION_REVIEW");

    const triggered: string[] = [];
    const errors: string[] = [];

    step = "trigger_reviews";
    for (const c of reviewReady) {
      try {
        const hash = await writeClient.writeContract({
          address: CONTRACT,
          functionName: "review_exception",
          args: [c.case_id],
          value: fee,
        });
        triggered.push(`review:${c.case_id}:${hash}`);
      } catch (e) {
        errors.push(`review:${c.case_id} — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    step = "trigger_recons";
    for (const c of reconReady) {
      const reconId = c.last_reconsideration_id;
      if (!reconId) {
        errors.push(`recon:${c.case_id} — no last_reconsideration_id`);
        continue;
      }
      try {
        const hash = await writeClient.writeContract({
          address: CONTRACT,
          functionName: "review_reconsideration",
          args: [reconId],
          value: fee,
        });
        triggered.push(`recon:${c.case_id}:${hash}`);
      } catch (e) {
        errors.push(`recon:${c.case_id} — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      triggered: triggered.length,
      items: triggered,
      errors,
      scanned: ids.length,
      readyForReview: reviewReady.length,
      readyForRecon: reconReady.length,
    });
  } catch (e) {
    return NextResponse.json(
      { step, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
