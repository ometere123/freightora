# Freightora — Cargo Exception Resolution

GenLayer-powered cargo exception resolution dApp. Disputes are resolved by evidence, records, and AI consensus — not arbitrators.

## What It Does

Freightora lets shippers, carriers, and warehouse operators file and resolve cargo exceptions (damage, shortage, delay, temperature excursion) on-chain. GenLayer validators independently review all evidence and produce a liability ruling. No human arbitrator decides the outcome.

## User Roles

| Role | Can Do |
|---|---|
| **Claimant** | Open case, add evidence, mark ready for review, propose/accept settlement, finalize, cancel |
| **Respondent** | Submit response, add evidence, propose/accept settlement, open reconsideration |
| **Resolver / Admin** | Everything above + trigger GenLayer review from `/resolve` queue |

## Case Flow

```
OPENED → CLAIM_EVIDENCE_SUBMITTED → RESPONDED → READY_FOR_REVIEW
→ UNDER_REVIEW → REVIEWED → FINALIZED
```

Branch paths: `SETTLEMENT_PROPOSED → SETTLEMENT_ACCEPTED → FINALIZED` or `RECONSIDERATION_REQUESTED → READY_FOR_RECONSIDERATION_REVIEW → REVIEWED → FINALIZED`

## Stack

- **Frontend** — Next.js 16 (App Router, Turbopack), Tailwind CSS
- **Chain** — GenLayer Studionet (chainId 61999)
- **SDK** — genlayer-js, viem
- **Wallet** — MetaMask (EIP-1193)
- **Cron** — cron-job.org → `/api/cron/review` (auto-triggers review every 5 min)

## Environment Variables

```env
NEXT_PUBLIC_GENLAYER_NETWORK_NAME=GenLayer Studionet
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
NEXT_PUBLIC_GENLAYER_CURRENCY=GEN
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=<your_contract_address>

# Server-side only (cron job)
CRON_SECRET=<random_secret>
ADMIN_PRIVATE_KEY=<admin_wallet_private_key>
```

## Local Development

```bash
npm install
cp .env.example .env.local
# fill in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Deploy on Vercel. Set all environment variables in **Project Settings → Environment Variables**. The cron job runs via [cron-job.org](https://cron-job.org) hitting `/api/cron/review` every 5 minutes with `Authorization: Bearer <CRON_SECRET>`.

## Contract

Freightora smart contract is a GenLayer Python AI contract at `contracts/Freightora.py`. Deploy via GenLayer Studio.
