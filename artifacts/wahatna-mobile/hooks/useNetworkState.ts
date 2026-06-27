import { useEffect, useRef, useState } from "react";
import { apiBase } from "@/constants/env";

export function useNetworkState() {
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    const url = `${apiBase()}/healthz`;
    try {
      const res = await fetch(url, { method: "GET" });
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, 8000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return { isOnline };
}
