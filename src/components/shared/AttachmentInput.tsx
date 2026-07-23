import { useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface AttachmentValue {
  name?: string;
  dataUrl?: string;
  type?: string;
  size?: number;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9ก-๙._-]+/g, "_").slice(0, 120);
}

export function AttachmentInput({
  value,
  onChange,
  label = "แนบไฟล์ (JPG, PNG, PDF ไม่เกิน 10MB)",
  capture,
}: {
  value?: AttachmentValue;
  onChange: (v: AttachmentValue | undefined) => void;
  label?: string;
  capture?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = (file: File) => {
    if (!ALLOWED.includes(file.type)) return toast.error("รองรับเฉพาะ JPG, PNG, PDF");
    if (file.size > MAX_BYTES) return toast.error("ไฟล์ต้องไม่เกิน 10MB");
    const reader = new FileReader();
    reader.onprogress = (e) =>
      e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    reader.onload = () => {
      setProgress(100);
      onChange({
        name: sanitize(file.name),
        dataUrl: reader.result as string,
        type: file.type,
        size: file.size,
      });
      setTimeout(() => setProgress(0), 400);
      toast.success("อัปโหลดไฟล์แล้ว");
    };
    reader.onerror = () => toast.error("อัปโหลดไม่สำเร็จ");
    reader.readAsDataURL(file);
  };

  const isImage = value?.type?.startsWith("image/");

  return (
    <div className="space-y-2">
      {!value?.dataUrl ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => ref.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">คลิกหรือลากไฟล์มาที่นี่</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
          {progress > 0 && progress < 100 && (
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <input
            ref={ref}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            {...(capture ? { capture: "environment" as const } : {})}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border p-3 bg-card">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary shrink-0 overflow-hidden">
            {isImage ? (
              <img src={value.dataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{value.name}</p>
            <p className="text-xs text-muted-foreground">
              {value.size ? `${(value.size / 1024).toFixed(1)} KB` : ""}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-xl"
            onClick={() => setPreview(true)}
            aria-label="ดู"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <a href={value.dataUrl} download={value.name}>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-xl"
              aria-label="ดาวน์โหลด"
            >
              <Download className="h-4 w-4" />
            </Button>
          </a>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-xl"
            onClick={() => onChange(undefined)}
            aria-label="ลบ"
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-4xl rounded-3xl p-2">
          {isImage ? (
            <img
              src={value?.dataUrl}
              alt={value?.name}
              className="max-h-[80vh] w-full object-contain rounded-2xl"
            />
          ) : (
            <iframe
              src={value?.dataUrl}
              className="w-full h-[80vh] rounded-2xl"
              title={value?.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AttachmentPreview({ value }: { value?: AttachmentValue }) {
  if (!value?.dataUrl) return null;
  const isImage = value.type?.startsWith("image/");
  return (
    <a
      href={value.dataUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      {isImage ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
      {value.name}
    </a>
  );
}
