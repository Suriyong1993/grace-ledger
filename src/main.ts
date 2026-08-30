import { getSupabaseClient } from "./lib/supabase/client";
import { router, MatchedRoute } from "./router";
import { renderAppShellHtml, AppShellUser } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { OfferingPage, OfferingPageMode } from "./pages/OfferingPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { FundsPage } from "./pages/FundsPage";
import { MembersPage } from "./pages/MembersPage";
import { ReportsPage } from "./pages/ReportsPage";
import { LoginPage } from "./pages/LoginPage";
import { PinSetupPage } from "./pages/PinSetupPage";
import { GraceAiDrawer } from "./components/ai-drawer/GraceAiDrawer";
import type { AiDrawerCallbacks } from "./components/ai-drawer/types";
import { UserRole } from "./lib/rbac";

interface ActiveSession {
  userId: string;
  churchId: string;
  user: AppShellUser;
}

export class App {
  private supabase = getSupabaseClient();
  private loginPage = new LoginPage(this.supabase);
  private pinSetupPage: PinSetupPage | null = null;
  private isPinSetupMode = false;
  private isBootstrappingSession = false;
  private dashboardPage: DashboardPage;
  private approvalsPage: ApprovalsPage | null = null;
  private offeringPage: OfferingPage | null = null;
  private transactionsPage: TransactionsPage | null = null;
  private fundsPage: FundsPage | null = null;
  private membersPage: MembersPage | null = null;
  private reportsPage: ReportsPage | null = null;
  private aiDrawer: GraceAiDrawer | null = null;
  /** Drawer hooks: draft cards hand the user over to the Transactions page. */
  private readonly aiDrawerCallbacks: AiDrawerCallbacks = {
    onDraftReview: () => {
      this.aiDrawer?.close();
      router.navigate("/transactions");
    },
  };
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

    // Detect if landing from a Magic Link / Bootstrap URL
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (
      hash.includes("type=magiclink") ||
      hash.includes("setup-pin") ||
      search.includes("type=magiclink")
    ) {
      this.isPinSetupMode = true;
    }

    this.supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (
        event === "SIGNED_IN" &&
        (this.isPinSetupMode || hash.includes("type=magiclink"))
      ) {
        this.isPinSetupMode = true;
      }

      if (!authSession) {
        this.session = null;
        this.pinSetupPage = null;
        this.approvalsPage = null;
        this.offeringPage = null;
        this.transactionsPage = null;
        this.fundsPage = null;
        this.membersPage = null;
        this.reportsPage = null;
        this.aiDrawer = null;
        void this.render();
      } else if (
        authSession.user &&
        !this.session &&
        !this.isBootstrappingSession
      ) {
        await this.loadSession(authSession.user.id);
        void this.render();
      }
    });

    const { data } = await this.supabase.auth.getSession();
    if (data.session?.user) {
      await this.loadSession(data.session.user.id);
    }

    router.subscribe(async (route) => {
      this.currentRoute = route;
      await this.render();
    });

    const initialRoute = router.matchRoute(
      window.location.hash || window.location.pathname,
    );
    this.currentRoute = initialRoute;
    await this.render();
  }

  private async loadSession(userId: string): Promise<void> {
    const { data: profile, error } = (await this.supabase
      .from("profiles")
      .select("full_name, church_id")
      .eq("id", userId)
      .single()) as {
      data: { full_name: string | null; church_id: string } | null;
      error: unknown;
    };

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
    ])) as [
      { data: { role: string } | null },
      { data: { name: string } | null },
    ];

    const fullName: string = profile.full_name ?? "";
    const userRole = (roleRow?.role as UserRole) || "member";
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

    if (this.isPinSetupMode) {
      this.pinSetupPage = new PinSetupPage(this.supabase, {
        name: fullName,
        role: roleRow?.role,
      });
      return;
    }

    this.approvalsPage = new ApprovalsPage(this.supabase, churchId, userId);
    this.offeringPage = new OfferingPage(
      this.supabase,
      churchId,
      userId,
      fullName,
    );
    this.transactionsPage = new TransactionsPage(this.supabase, churchId);
    this.fundsPage = new FundsPage(this.supabase, churchId);
    this.membersPage = new MembersPage(this.supabase, churchId);
    this.reportsPage = new ReportsPage(this.supabase, churchId);
    this.aiDrawer = new GraceAiDrawer(
      this.supabase,
      churchId,
      userRole,
      userId,
      this.aiDrawerCallbacks,
    );
  }

  private async handlePinAuthenticated(userId: string): Promise<void> {
    this.isBootstrappingSession = true;
    try {
      await this.loadSession(userId);
      await this.render();
    } finally {
      this.isBootstrappingSession = false;
    }
  }

  public async render(): Promise<void> {
    if (!this.rootElement) return;

    // 1. PIN Setup Mode (Bootstrap from Magic Link)
    if (this.isPinSetupMode && this.pinSetupPage) {
      this.rootElement.innerHTML = this.pinSetupPage.renderHtml();
      this.pinSetupPage.attachEventListeners(this.rootElement, () => {
        this.isPinSetupMode = false;
        this.pinSetupPage = null;
        this.session = null;
        // Clean URL hash
        if (
          window.location.hash.includes("type=magiclink") ||
          window.location.hash.includes("setup-pin")
        ) {
          window.history.replaceState(null, "", window.location.pathname);
        }
        void this.render();
      });
      return;
    }

    // 2. Unauthenticated Login Page (Profile + PIN Keypad)
    if (!this.session) {
      this.rootElement.innerHTML = this.loginPage.renderHtml();
      this.loginPage.attachEventListeners(this.rootElement, {
        onPinAuthenticated: (userId) =>
          void this.handlePinAuthenticated(userId),
      });
      return;
    }

    // 3. Authenticated App Shell & Dashboard
    let contentHtml = "";

    if (
      this.currentRoute.pattern === "/" ||
      this.currentRoute.pattern === "not_found"
    ) {
      const data = await this.dashboardPage.loadData(this.session.churchId);
      this.pendingCount = data.pendingApprovalsCount;
      contentHtml = this.dashboardPage.renderHtml(data);
    } else if (this.currentRoute.pattern === "/transactions") {
      if (this.transactionsPage) {
        await this.transactionsPage.loadData();
        contentHtml = this.transactionsPage.renderHtml();
      }
    } else if (this.currentRoute.pattern === "/funds") {
      if (this.fundsPage) {
        await this.fundsPage.loadData();
        contentHtml = this.fundsPage.renderHtml();
      }
    } else if (this.currentRoute.pattern === "/members") {
      if (this.membersPage) {
        await this.membersPage.loadData();
        contentHtml = this.membersPage.renderHtml();
      }
    } else if (this.currentRoute.pattern === "/reports") {
      if (this.reportsPage) {
        await this.reportsPage.loadData();
        contentHtml = this.reportsPage.renderHtml();
      }
    } else if (
      this.currentRoute.pattern === "/approvals" ||
      this.currentRoute.pattern === "/approvals/:id"
    ) {
      contentHtml = this.approvalsPage?.renderHtml() ?? "";
    } else if (this.currentRoute.pattern.startsWith("/offerings")) {
      if (this.offeringPage) {
        const offeringMode: OfferingPageMode =
          this.currentRoute.pattern === "/offerings/new"
            ? "new"
            : this.currentRoute.pattern === "/offerings/:id"
              ? "detail"
              : "list";
        const offeringSessionId =
          this.currentRoute.pattern === "/offerings/:id"
            ? this.currentRoute.params.id
            : undefined;
        const shouldLoadOfferingData = this.offeringPage.syncRoute(
          offeringMode,
          offeringSessionId,
        );
        if (shouldLoadOfferingData) {
          await this.offeringPage.loadInitialData(offeringSessionId);
        }
        contentHtml = this.offeringPage.renderHtml();
      }
    }

    const appShellHtml = renderAppShellHtml(
      {
        activeRoute: this.currentRoute.path,
        pendingCount: this.pendingCount,
        user: this.session.user,
      },
      contentHtml,
    );

    const aiDrawerHtml = this.aiDrawer?.renderHtml() ?? "";

    this.rootElement.innerHTML = appShellHtml + aiDrawerHtml;

    if (this.currentRoute.pattern.startsWith("/approvals")) {
      this.approvalsPage?.attachEventListeners(this.rootElement, () =>
        this.render(),
      );
    } else if (this.currentRoute.pattern.startsWith("/offerings")) {
      this.offeringPage?.attachEventListeners(this.rootElement, () =>
        this.render(),
      );
    } else if (this.currentRoute.pattern === "/transactions") {
      this.transactionsPage?.attachEventListeners(this.rootElement, () =>
        this.render(),
      );
    } else if (this.currentRoute.pattern === "/funds") {
      this.fundsPage?.attachEventListeners(this.rootElement, () =>
        this.render(),
      );
    } else if (this.currentRoute.pattern === "/members") {
      this.membersPage?.attachEventListeners(this.rootElement, () =>
        this.render(),
      );
    } else if (this.currentRoute.pattern === "/reports") {
      this.reportsPage?.attachEventListeners(this.rootElement, () =>
        this.render(),
      );
    }

    // Attach AI Drawer Event Listeners
    if (this.aiDrawer) {
      this.aiDrawer.attachEventListeners(
        this.rootElement,
        this.aiDrawerCallbacks,
        () => this.render(),
      );
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
