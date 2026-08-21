import { OtherShell } from "@/components/OtherShell";

// Scoped to /alerts instead of the (other) group root on purpose: /admin
// shares that root and is robots-disallowed + auth-gated (middleware.ts),
// so it must not inherit public-site header/footer chrome.
export default function AlertsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OtherShell>{children}</OtherShell>;
}
