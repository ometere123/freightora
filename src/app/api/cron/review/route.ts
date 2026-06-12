import { NextRequest, NextResponse } from "next/server";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";

const CONTRACT = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`;

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

  // Read client — no wallet needed
  const readClient = createClient({ chain: studionet });

  // Write client — uses private key, no MetaMask
  const writeClient = createClient({
    chain: studionet,
    account: account.address,
    // @ts-expect-error — genlayer-js accepts a viem account as provider for server-side use
    provider: account,
  });

  try {
    // Get review fee from config
    const configRaw = await readClient.readContract({
      address: CONTRACT,
      functionName: "get_config",
      args: [],
    });
    const config = parseJson<{ review_fee: string }>(configRaw);
    const fee = BigInt(config?.review_fee ?? "10000000000000000");

    // List all case IDs — args are strings in this contract
    const idsRaw = await readClient.readContract({
      address: CONTRACT,
      functionName: "list_cases",
      args: ["0", "200"],
    });
    const ids = parseJson<string[]>(idsRaw);
    if (!ids?.length) {
      return NextResponse.json({ triggered: 0, message: "No cases found" });
    }

    // Fetch each case
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

    for (const c of reviewReady) {
      try {
        await writeClient.writeContract({
          address: CONTRACT,
          functionName: "review_exception",
          args: [c.case_id],
          value: fee,
        });
        triggered.push(`review:${c.case_id}`);
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
        await writeClient.writeContract({
          address: CONTRACT,
          functionName: "review_reconsideration",
          args: [reconId],
          value: fee,
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
