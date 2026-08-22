export type RoutePattern =
  | "/"
  | "/transactions"
  | "/funds"
  | "/members"
  | "/reports"
  | "/approvals"
  | "/approvals/:id"
  | "/offerings"
  | "/offerings/new"
  | "/offerings/:id";

export interface MatchedRoute {
  path: string;
  pattern: RoutePattern | "not_found";
  params: Record<string, string>;
}

export type RouteListener = (route: MatchedRoute) => void;

class ClientRouter {
  private listeners: RouteListener[] = [];
  private currentRoute: MatchedRoute = { path: "/", pattern: "/", params: {} };

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", () => this.handleLocationChange());
      window.addEventListener("hashchange", () => this.handleLocationChange());
    }
  }

  public matchRoute(pathname: string): MatchedRoute {
    // Normalize path (handle hash routing or path routing)
    let cleanPath = pathname;
    if (cleanPath.startsWith("#")) {
      cleanPath = cleanPath.substring(1);
    }
    if (!cleanPath.startsWith("/")) {
      cleanPath = "/" + cleanPath;
    }
    // Remove trailing slash if not root
    if (cleanPath.length > 1 && cleanPath.endsWith("/")) {
      cleanPath = cleanPath.substring(0, cleanPath.length - 1);
    }

    if (cleanPath === "" || cleanPath === "/") {
      return { path: "/", pattern: "/", params: {} };
    }

    if (cleanPath === "/transactions") {
      return { path: "/transactions", pattern: "/transactions", params: {} };
    }

    if (cleanPath === "/funds") {
      return { path: "/funds", pattern: "/funds", params: {} };
    }

    if (cleanPath === "/members") {
      return { path: "/members", pattern: "/members", params: {} };
    }

    if (cleanPath === "/reports") {
      return { path: "/reports", pattern: "/reports", params: {} };
    }

    if (cleanPath === "/approvals") {
      return { path: "/approvals", pattern: "/approvals", params: {} };
    }

    // Match /approvals/:id
    const approvalsMatch = cleanPath.match(/^\/approvals\/([a-zA-Z0-9_-]+)$/);
    if (approvalsMatch) {
      return {
        path: cleanPath,
        pattern: "/approvals/:id",
        params: { id: approvalsMatch[1] },
      };
    }

    // M3 Offering routes
    if (cleanPath === "/offerings") {
      return { path: "/offerings", pattern: "/offerings", params: {} };
    }

    if (cleanPath === "/offerings/new") {
      return { path: "/offerings/new", pattern: "/offerings/new", params: {} };
    }

    // Match /offerings/:id
    const offeringsMatch = cleanPath.match(/^\/offerings\/([a-zA-Z0-9_-]+)$/);
    if (offeringsMatch) {
      return {
        path: cleanPath,
        pattern: "/offerings/:id",
        params: { id: offeringsMatch[1] },
      };
    }

    return { path: cleanPath, pattern: "not_found", params: {} };
  }

  public getCurrentRoute(): MatchedRoute {
    if (typeof window === "undefined") {
      return this.currentRoute;
    }
    const path = window.location.hash ? window.location.hash.substring(1) : window.location.pathname;
    return this.matchRoute(path);
  }

  public navigate(to: string): void {
    if (typeof window === "undefined") return;

    // Use hash navigation for reliable SPA static serving or pushState
    const targetHash = to.startsWith("#") ? to : `#${to.startsWith("/") ? to : "/" + to}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    } else {
      this.handleLocationChange();
    }
  }

  public subscribe(listener: RouteListener): () => void {
    this.listeners.push(listener);
    // Immediately emit current route
    listener(this.getCurrentRoute());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private handleLocationChange(): void {
    this.currentRoute = this.getCurrentRoute();
    for (const listener of this.listeners) {
      listener(this.currentRoute);
    }
  }
}

export const router = new ClientRouter();
