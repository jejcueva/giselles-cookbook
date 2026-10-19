"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

type Viewer = {
  ready: boolean;
  isRecruiter: boolean;
  canWrite: boolean;
};

const ViewerContext = createContext<Viewer>({
  ready: false,
  isRecruiter: false,
  canWrite: false,
});

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [viewer, setViewer] = useState<Viewer>({
    ready: false,
    isRecruiter: false,
    canWrite: false,
  });

  useEffect(() => {
    let active = true;

    fetch("/api/auth/session")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { role?: string };
      })
      .then((data) => {
        if (!active) return;
        const isRecruiter = data?.role === "recruiter";
        const isOwner = data?.role === "owner";
        setViewer({ ready: true, isRecruiter, canWrite: isOwner });
      })
      .catch(() => {
        if (!active) return;
        setViewer({ ready: true, isRecruiter: false, canWrite: false });
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  return useContext(ViewerContext);
}
