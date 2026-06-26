import { useEffect, useRef, useState } from "react";

export function useNetworkState() {
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const url = domain ? `https://${domain}/api/healthz` : "http://localhost:8080/api/healthz";
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
