"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UNAUTHORIZED_EVENT } from "./api";

/** When any API call returns 401 (session expired/idle), go back to sign-in. */
export function AuthWatcher() {
  const router = useRouter();
  useEffect(() => {
    const h = () => router.replace("/login");
    window.addEventListener(UNAUTHORIZED_EVENT, h);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, h);
  }, [router]);
  return null;
}
