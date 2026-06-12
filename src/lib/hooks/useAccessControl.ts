"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/store";
import { getOwner, isResolverAddress } from "@/lib/genlayer/contract";

export interface AccessState {
  loading: boolean;
  isOwner: boolean;
  isResolver: boolean;
  isAdminOrResolver: boolean;
}

// Module-level cache — survives re-renders, cleared on wallet change
let cachedAccount: string | null = null;
let cachedResult: AccessState | null = null;
let inflightPromise: Promise<AccessState> | null = null;

export function useAccessControl(): AccessState {
  const { account } = useWallet();
  const [state, setState] = useState<AccessState>(() => {
    // Return cached result immediately if account matches
    if (account && cachedAccount === account && cachedResult) return cachedResult;
    return { loading: true, isOwner: false, isResolver: false, isAdminOrResolver: false };
  });

  useEffect(() => {
    if (!account) {
      cachedAccount = null;
      cachedResult = null;
      inflightPromise = null;
      setState({ loading: false, isOwner: false, isResolver: false, isAdminOrResolver: false });
      return;
    }

    // Already resolved for this account — use cache
    if (cachedAccount === account && cachedResult) {
      setState(cachedResult);
      return;
    }

    // Deduplicate concurrent callers — reuse the same in-flight promise
    if (!inflightPromise || cachedAccount !== account) {
      cachedAccount = account;
      inflightPromise = Promise.allSettled([getOwner(), isResolverAddress(account)])
        .then(([ownerRes, resolverRes]) => {
          const isOwner =
            ownerRes.status === "fulfilled" &&
            Boolean(ownerRes.value) &&
            (ownerRes.value as string).toLowerCase() === account.toLowerCase();
          const isResolver =
            resolverRes.status === "fulfilled" && resolverRes.value === true;
          const result: AccessState = {
            loading: false,
            isOwner,
            isResolver,
            isAdminOrResolver: isOwner || isResolver,
          };
          cachedResult = result;
          inflightPromise = null;
          return result;
        })
        .catch((): AccessState => {
          inflightPromise = null;
          return { loading: false, isOwner: false, isResolver: false, isAdminOrResolver: false };
        });
    }

    setState((s) => ({ ...s, loading: true }));
    inflightPromise.then(setState);
  }, [account]);

  return state;
}
