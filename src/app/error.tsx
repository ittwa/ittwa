"use client";

import { ErrorState } from "@/components/error-state";

// Renders inside RootLayout — nav and footer stay on screen instead of the
// unbranded Next.js fallback, since error.tsx wraps page.js/loading.js and
// nested layouts but not the layout above it in the same segment.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorState error={error} onRetry={unstable_retry} />;
}
