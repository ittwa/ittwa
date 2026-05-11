"use client";

import { createContext, useContext, useState } from "react";

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
}: {
  avatarId: string | undefined;
  name: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!avatarId || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://sleepercdn.com/avatars/${avatarId}`}
      alt={name}
      onError={() => setFailed(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
