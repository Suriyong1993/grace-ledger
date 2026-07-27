import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Safely register plugins in client-side / browser environment
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };
