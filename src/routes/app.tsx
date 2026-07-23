import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/AppShell";
import { RouteErrorFallback } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/app")({
  component: () => (
    <AuthGuard>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthGuard>
  ),
  errorComponent: ({ error, reset }) => (
    <AuthGuard>
      <AppShell>
        <RouteErrorFallback error={error} reset={reset} />
      </AppShell>
    </AuthGuard>
  ),
});
