"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResolverRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/resolve"); }, [router]);
  return null;
}
