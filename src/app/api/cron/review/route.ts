import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, defineChain, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const studionet = defineChain({
  id: 61999,
  name: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api"] },
  },
});

const CONTRACT = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`;

// Minimal ABI — only what the cron needs
const ABI = [
  {
    name: "list_all_cases",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }],
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
  {
    name: "get_review_fee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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
  // Authenticate — Vercel sets Authorization: Bearer <CRON_SECRET>
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
  const publicClient = createPublicClient({ chain: studionet, transport: http() });
  const walletClient = createWalletClient({ chain: studionet, account, transport: http() });

  try {
    // Fetch review fee
    const feeRaw = await publicClient.readContract({
      address: CONTRACT, abi: ABI, functionName: "get_review_fee",
    });
    const fee = BigInt(String(feeRaw));

    // Fetch all case IDs
    const idsRaw = await publicClient.readContract({
      address: CONTRACT, abi: ABI, functionName: "list_all_cases",
      args: [BigInt(0), BigInt(200)],
    });
    const ids = parseJson<string[]>(idsRaw);
    if (!ids?.length) {
      return NextResponse.json({ triggered: 0, message: "No cases found" });
    }

    // Fetch each case to check status
    const caseResults = await Promise.allSettled(
      ids.map((id) =>
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: "get_case", args: [id] })
          .then((r) => parseJson<CaseData>(r))
      )
    );

    const cases = caseResults
      .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));

    const reviewReady = cases.filter((c) => c.status === "READY_FOR_REVIEW");
    const reconReady = cases.filter((c) => c.status === "READY_FOR_RECONSIDERATION_REVIEW");

    const triggered: string[] = [];
    const errors: string[] = [];

    // Trigger review for each READY_FOR_REVIEW case
    for (const c of reviewReady) {
      try {
        await walletClient.writeContract({
          address: CONTRACT, abi: ABI, functionName: "review_exception",
          args: [c.case_id], value: fee,
        });
        triggered.push(`review:${c.case_id}`);
      } catch (e) {
        errors.push(`review:${c.case_id} — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Trigger reconsideration review for each READY_FOR_RECONSIDERATION_REVIEW case
    for (const c of reconReady) {
      const reconId = c.last_reconsideration_id;
      if (!reconId) { errors.push(`recon:${c.case_id} — no last_reconsideration_id`); continue; }
      try {
        await walletClient.writeContract({
          address: CONTRACT, abi: ABI, functionName: "review_reconsideration",
          args: [reconId], value: fee,
        });
        triggered.push(`recon:${c.case_id}`);
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
      { error: e instanceof Error ? e.message : "Cron failed" },
      { status: 500 }
    );
  }
}
