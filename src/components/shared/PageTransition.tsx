import { ReactNode } from "react";
import { useGSAPAnimation } from "@/hooks/useGSAPAnimation";
import { gsap } from "@/lib/gsap";

interface Props {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = "" }: Props) {
  const containerRef = useGSAPAnimation<HTMLDivElement>((el) => {
    gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
  });

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
