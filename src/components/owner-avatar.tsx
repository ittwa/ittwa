"use client";

import { createContext, useContext, useState } from "react";
import Image from "next/image";

const OwnerAvatarsContext = createContext<Record<string, string>>({});

export function OwnerAvatarsProvider({
  avatars,
  children,
}: {
  avatars: Record<string, string>;
  children: React.ReactNode;
}) {
  return <OwnerAvatarsContext.Provider value={avatars}>{children}</OwnerAvatarsContext.Provider>;
}

export function useOwnerAvatar(name: string): string | undefined {
  return useContext(OwnerAvatarsContext)[name];
}

export function SleeperAvatarImage({
  avatarId,
  name,
  fallback,
  // These avatars render small (~14-44px). Without `sizes`, a `fill` image is
  // optimized at w=3840. 64px is a safe upper bound for avatar use; override
  // for larger renders.
  sizes = "64px",
}: {
  avatarId: string | undefined;
  name: string;
  fallback: React.ReactNode;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!avatarId || failed) return <>{fallback}</>;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Image
        src={`https://sleepercdn.com/avatars/${avatarId}`}
        alt={name}
        fill
        sizes={sizes}
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
