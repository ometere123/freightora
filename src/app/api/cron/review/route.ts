import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const studionet = defineChain({
  id: 61999,
  name: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api"],
    },
  },
});

const CONTRACT = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`;

const ABI = [
  {
    name: "get_config",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "list_cases",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "string" },
      { name: "limit", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "get_case",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "case_id", type: "string" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "review_exception",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "case_id", type: "string" }],
    outputs: [],
  },
  {
    name: "review_reconsideration",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "reconsideration_id", type: "string" }],
    outputs: [],
  },
] as const;

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
  const transport = http();

  const publicClient = createPublicClient({ chain: studionet, transport });
  const walletClient = createWalletClient({ chain: studionet, account, transport });

  let step = "init";
  try {
    // Get review fee
    step = "get_config";
    const configRaw = await publicClient.readContract({
      address: CONTRACT, abi: ABI, functionName: "get_config",
    });
    const config = parseJson<{ review_fee: string }>(configRaw);
    const fee = BigInt(config?.review_fee ?? "10000000000000000");

    // List all case IDs
    step = "list_cases";
    const idsRaw = await publicClient.readContract({
      address: CONTRACT, abi: ABI, functionName: "list_cases",
      args: ["0", "200"],
    });
    step = "parse_ids";
    const ids = parseJson<string[]>(idsRaw);
    if (!ids?.length) {
      return NextResponse.json({ triggered: 0, message: "No cases found" });
    }

    // Fetch each case status
    const caseResults = await Promise.allSettled(
      ids.map((id) =>
        publicClient.readContract({
          address: CONTRACT, abi: ABI, functionName: "get_case", args: [id],
        }).then((r) => parseJson<CaseData>(r))
      )
    );

    const cases = caseResults.flatMap((r) =>
      r.status === "fulfilled" && r.value ? [r.value] : []
    );

    const reviewReady = cases.filter((c) => c.status === "READY_FOR_REVIEW");
    const reconReady = cases.filter((c) => c.status === "READY_FOR_RECONSIDERATION_REVIEW");

    const triggered: string[] = [];
    const errors: string[] = [];

    for (const c of reviewReady) {
      try {
        const hash = await walletClient.writeContract({
          address: CONTRACT, abi: ABI, functionName: "review_exception",
          args: [c.case_id], value: fee,
        });
        triggered.push(`review:${c.case_id}:${hash}`);
      } catch (e) {
        errors.push(`review:${c.case_id} — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const c of reconReady) {
      const reconId = c.last_reconsideration_id;
      if (!reconId) {
        errors.push(`recon:${c.case_id} — no last_reconsideration_id`);
        continue;
      }
      try {
        const hash = await walletClient.writeContract({
          address: CONTRACT, abi: ABI, functionName: "review_reconsideration",
          args: [reconId], value: fee,
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
