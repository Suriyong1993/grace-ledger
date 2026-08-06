import { useEffect, useState } from "react";
import { Delete, Fingerprint } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  length?: number;
  onSubmit: (pin: string) => void | Promise<boolean | void>;
  autoSubmit?: boolean;
  title?: string;
  subtitle?: string;
}

export function PinPad({
  length = 6,
  onSubmit,
  autoSubmit = true,
  title = "กรอกรหัส PIN",
  subtitle,
}: Props) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    setBusy(true);
    try {
      const res = await onSubmit(value);
      if (res === false) {
        setShake(true);
        setPin("");
        setTimeout(() => setShake(false), 500);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (autoSubmit && pin.length === length) submit(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const press = (v: string) => {
    if (busy) return;
    if (v === "back") setPin((p) => p.slice(0, -1));
    else if (v === "clear") setPin("");
    else if (pin.length < length) setPin((p) => p + v);
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
          <Fingerprint className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      <motion.div
        animate={shake ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex justify-center gap-3 mb-8"
      >
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 w-4 rounded-full transition-all",
              i < pin.length ? "bg-primary scale-110" : "bg-muted",
            )}
          />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <Button key={n} variant="secondary" size="lg" onClick={() => press(n)}>
            {n}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="lg"
          className="h-16 text-sm rounded-2xl"
          onClick={() => press("clear")}
        >
          ล้าง
        </Button>
        <Button variant="secondary" size="lg" onClick={() => press("0")}>
          0
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="h-16 rounded-2xl"
          onClick={() => press("back")}
          aria-label="ลบ"
        >
          <Delete className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
