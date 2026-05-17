import { LoginForm } from "@/components/AdminLoginForm";

export const metadata = { title: "Admin sign-in — RealData" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="max-w-md mx-auto p-6 mt-12">
      <h1 className="text-2xl font-bold mb-1">Admin sign-in</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Enter the shared admin secret to access protected pages.
      </p>
      <LoginForm next={next} initialError={error} />
    </main>
  );
}
