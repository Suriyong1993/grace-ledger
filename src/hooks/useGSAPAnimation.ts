import { useEffect, useRef, type DependencyList } from "react";
import { gsap } from "@/lib/gsap";

/**
 * A safe React hook for running GSAP animations with automatic context scope and cleanup.
 * Prevents memory leaks, duplicate animations, and SSR errors.
 */
export function useGSAPAnimation<T extends HTMLElement = HTMLDivElement>(
  animationCallback: (element: T) => void,
  deps: DependencyList = [],
) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    const el = containerRef.current;
    const ctx = gsap.context(() => {
      animationCallback(el);
    }, el);

    return () => {
      ctx.revert();
    };
  }, deps);

  return containerRef;
}
