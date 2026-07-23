import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-dvh flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <AppTopbar />
          <motion.main
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-10"
          >
            <Outlet />
          </motion.main>
          <BottomNav />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
