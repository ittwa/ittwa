// The constitution page is a client component, which cannot export `metadata`.
// A route-segment layout (server component) supplies the title instead.
export const metadata = { title: "Constitution" };

export default function ConstitutionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
