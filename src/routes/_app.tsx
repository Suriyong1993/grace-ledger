import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth, REDIRECT_STORAGE_KEY } from "@/lib/auth";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DashboardSkeleton } from "@/components/shared/Skeleton";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) return <DashboardSkeleton />;
  if (!user) {
    // Remember where the user was headed so /auth can send them back after
    // login instead of always landing on /dashboard.
    const dest = window.location.pathname + window.location.search;
    if (dest !== "/auth") sessionStorage.setItem(REDIRECT_STORAGE_KEY, dest);
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-dvh flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <AppTopbar />
          <ErrorBoundary>
            <motion.main
              key="page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="min-w-0 flex-1 px-4 md:px-8 py-6 pb-24 md:pb-10"
            >
              <Outlet />
            </motion.main>
          </ErrorBoundary>
          <BottomNav />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
