import { getSupabaseClient } from "./lib/supabase/client";
import { router, MatchedRoute } from "./router";
import { renderAppShellHtml, AppShellUser } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { OfferingPage } from "./pages/OfferingPage";
import { LoginPage } from "./pages/LoginPage";

interface ActiveSession {
  userId: string;
  churchId: string;
  user: AppShellUser;
}

export class App {
  private supabase = getSupabaseClient();
  private loginPage = new LoginPage();
  private dashboardPage: DashboardPage;
  private approvalsPage: ApprovalsPage | null = null;
  private offeringPage: OfferingPage | null = null;
  private currentRoute: MatchedRoute = { path: "/", pattern: "/", params: {} };
  private rootElement: HTMLElement | null = null;
  private pendingCount = 0;
  private session: ActiveSession | null = null;

  constructor() {
    this.dashboardPage = new DashboardPage(this.supabase);
  }

  public async init(): Promise<void> {
    this.rootElement = document.getElementById("app");
    if (!this.rootElement) return;

    this.supabase.auth.onAuthStateChange((_event, authSession) => {
      if (!authSession) {
        this.session = null;
        this.approvalsPage = null;
        this.offeringPage = null;
        void this.render();
      }
    });

    const { data } = await this.supabase.auth.getSession();
    if (data.session?.user) {
      await this.loadSession(data.session.user.id);
    }

    router.subscribe(async (route) => {
      const routeChanged = this.currentRoute.path !== route.path;
      this.currentRoute = route;

      if (routeChanged && this.session) {
        if (route.pattern === "/offerings") {
          await this.offeringPage?.init("list");
        } else if (route.pattern === "/offerings/new") {
          await this.offeringPage?.init("new");
        } else if (route.pattern === "/offerings/:id") {
          await this.offeringPage?.init("detail", route.params.id);
        } else if (route.pattern === "/approvals") {
          this.approvalsPage?.setSelectedItem(null);
          await this.approvalsPage?.loadQueue();
        } else if (route.pattern === "/approvals/:id") {
          this.approvalsPage?.setSelectedItem(route.params.id);
          if (this.approvalsPage && this.approvalsPage.getItems().length === 0) {
            await this.approvalsPage.loadQueue();
          }
        }
      }

      await this.render();
    });
  }

  private async loadSession(userId: string): Promise<void> {
    const { data: profile, error } = (await this.supabase
      .from("profiles")
      .select("id, church_id, full_name")
      .eq("id", userId)
      .single()) as { data: { id: string; church_id: string; full_name: string } | null; error: unknown };

    if (error || !profile) {
      console.error("Failed to load profile for authenticated user:", error);
      await this.supabase.auth.signOut();
      this.session = null;
      return;
    }

    const churchId: string = profile.church_id;

    const [{ data: roleRow }, { data: church }] = (await Promise.all([
      this.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("church_id", churchId)
        .limit(1)
        .maybeSingle(),
      this.supabase.from("churches").select("name").eq("id", churchId).single(),
    ])) as [{ data: { role: string } | null }, { data: { name: string } | null }];

    const fullName: string = profile.full_name ?? "";
    const initials = fullName
      .split(" ")
      .map((part: string) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();

    this.session = {
      userId,
      churchId,
      user: {
        name: fullName,
        role: roleRow?.role ?? "",
        initials: initials || "?",
        churchName: church?.name,
      },
    };

    this.approvalsPage = new ApprovalsPage(this.supabase, churchId, userId);
    this.offeringPage = new OfferingPage(this.supabase, churchId, userId, fullName);
  }

  private async handleLoginSubmit(email: string, password: string): Promise<void> {
    this.loginPage.setError(null);
    this.loginPage.setSubmitting(true);
    await this.render();

    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      this.loginPage.setSubmitting(false);
      this.loginPage.setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      await this.render();
      return;
    }

    await this.loadSession(data.user.id);
    this.loginPage.setSubmitting(false);
    await this.render();
  }

  public async render(): Promise<void> {
    if (!this.rootElement) return;

    if (!this.session) {
      this.rootElement.innerHTML = this.loginPage.renderHtml();
      this.loginPage.attachEventListeners(this.rootElement, (email, password) =>
        this.handleLoginSubmit(email, password)
      );
      return;
    }

    let contentHtml = "";

    if (this.currentRoute.pattern === "/" || this.currentRoute.pattern === "not_found") {
      const data = await this.dashboardPage.loadData(this.session.churchId);
      this.pendingCount = data.pendingApprovalsCount;
      contentHtml = this.dashboardPage.renderHtml(data);
    } else if (this.currentRoute.pattern === "/approvals" || this.currentRoute.pattern === "/approvals/:id") {
      contentHtml = this.approvalsPage?.renderHtml() ?? "";
    } else if (this.currentRoute.pattern.startsWith("/offerings")) {
      contentHtml = this.offeringPage?.renderHtml() ?? "";
    }

    this.rootElement.innerHTML = renderAppShellHtml(
      {
        activeRoute: this.currentRoute.path,
        pendingCount: this.pendingCount,
        user: this.session.user,
      },
      contentHtml
    );

    if (this.currentRoute.pattern.startsWith("/approvals")) {
      this.approvalsPage?.attachEventListeners(this.rootElement, () => this.render());
    } else if (this.currentRoute.pattern.startsWith("/offerings")) {
      this.offeringPage?.attachEventListeners(this.rootElement, () => this.render());
    }
  }
}

// Bootstrap
if (typeof window !== "undefined") {
  const bootstrap = () => {
    const app = new App();
    app.init();
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
}
