"use client";

import NextLink from "next/link";
import { useState, type ComponentProps } from "react";

// Drop-in replacement for next/link that prefetches on user INTENT (hover,
// touch, keyboard focus) instead of whenever the link scrolls into view.
//
// Why: every page here is dynamic, so each automatic viewport prefetch is a
// Vercel Function invocation. A single page view was firing 7–29 prefetches
// (nav menu, every owner chip, every player link), which, together with cold
// starts, pushed the project past the Hobby plan's Fluid Active CPU limit
// (Nov 2026). Prefetching on intent keeps navigation snappy for the link the
// user is actually about to click without warming the whole site per visit.
//
// Pattern from Next's own prefetching guide ("Hover-triggered prefetch"):
// `prefetch={false}` until intent, then `null` (the default behaviour).
// An explicit `prefetch` prop from the caller is always respected.
type LinkProps = ComponentProps<typeof NextLink>;

export default function Link({ prefetch, onMouseEnter, onTouchStart, onFocus, ...rest }: LinkProps) {
  const [intent, setIntent] = useState(false);

  if (prefetch !== undefined) {
    return <NextLink prefetch={prefetch} onMouseEnter={onMouseEnter} onTouchStart={onTouchStart} onFocus={onFocus} {...rest} />;
  }

  return (
    <NextLink
      {...rest}
      prefetch={intent ? null : false}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
    />
  );
}
