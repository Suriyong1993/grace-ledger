import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { OfflineIndicator } from "@/components/shared/OfflineIndicator";
import { Button } from "@/components/ui/button";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="kicker justify-center">Grace Ledger</p>
        <h1 className="num-display font-display mt-3 text-7xl font-semibold text-foreground">
          404
        </h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">ไม่พบหน้าที่ค้นหา</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          หน้าที่คุณต้องการไม่มีอยู่ หรือถูกย้ายไปแล้ว
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">กลับหน้าหลัก</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          โหลดหน้านี้ไม่สำเร็จ
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          เกิดข้อผิดพลาดจากระบบ ลองรีเฟรชอีกครั้ง หรือกลับไปหน้าหลัก
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            ลองอีกครั้ง
          </Button>
          {/* Plain <a> preserved deliberately (not <Link>) — a full page
              reload is the safer recovery path from an error boundary. */}
          <Button asChild variant="outline">
            <a href="/">กลับหน้าหลัก</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ระบบจัดการการเงินคริสตจักร" },
      {
        name: "description",
        content: "ระบบบริหารการเงิน รายรับ รายจ่าย เงินถวาย กองทุน และงบประมาณของคริสตจักร",
      },
      { name: "author", content: "Church Finance" },
      { property: "og:title", content: "ระบบจัดการการเงินคริสตจักร" },
      { property: "og:description", content: "ระบบบริหารการเงินคริสตจักรที่ใช้งานง่ายและปลอดภัย" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // TODO(UI-VERIFY): approximate hex for the new v3.0 primary blue
      // (oklch(0.53 0.17 258)); sample the exact rendered --color-primary
      // value with a browser color picker for a pixel-perfect match — not
      // verifiable in this sandbox (no browser available).
      { name: "theme-color", content: "#2E5FE0" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster position="top-right" richColors />
          <OfflineIndicator />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
