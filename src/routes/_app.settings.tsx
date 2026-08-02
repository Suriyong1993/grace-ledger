import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Eye,
  ArrowUpDown,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  listOfferingCategories,
  createOfferingCategory,
  updateOfferingCategory,
  deleteOfferingCategory,
  reorderOfferingCategories,
  listOfferingSubcategories,
  createOfferingSubcategory,
  updateOfferingSubcategory,
  deleteOfferingSubcategory,
} from "@/services/church";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "ตั้งค่า" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Queries
  const catsQ = useQuery({ queryKey: ["offering-categories"], queryFn: listOfferingCategories });
  const subsQ = useQuery({
    queryKey: ["offering-subcategories"],
    queryFn: () => listOfferingSubcategories(),
  });
  const categories = catsQ.data ?? [];
  const allSubs = subsQ.data ?? [];

  // Category CRUD
  const createCat = useMutation({
    mutationFn: (v: { name: string; color: string; icon?: string }) =>
      createOfferingCategory({ name: v.name, color: v.color, icon: v.icon ?? "Circle" }, user!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offering-categories"] });
      toast.success("เพิ่มหมวดหมู่แล้ว");
    },
  });
  const updateCat = useMutation({
    mutationFn: ({ id, ...v }: { id: string; name?: string; color?: string; isActive?: boolean }) =>
      updateOfferingCategory(id, v, user!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offering-categories"] });
      toast.success("อัปเดตหมวดหมู่แล้ว");
    },
  });
  const deleteCat = useMutation({
    mutationFn: (id: string) => deleteOfferingCategory(id, user!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offering-categories"] });
      qc.invalidateQueries({ queryKey: ["offering-subcategories"] });
      toast.success("ลบหมวดหมู่แล้ว");
    },
  });

  // Subcategory CRUD
  const createSub = useMutation({
    mutationFn: (v: { categoryId: string; name: string }) => createOfferingSubcategory(v, user!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offering-subcategories"] });
      toast.success("เพิ่มหมวดย่อยแล้ว");
    },
  });
  const updateSub = useMutation({
    mutationFn: ({ id, ...v }: { id: string; name?: string; isActive?: boolean }) =>
      updateOfferingSubcategory(id, v, user!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offering-subcategories"] });
      toast.success("อัปเดตหมวดย่อยแล้ว");
    },
  });
  const deleteSub = useMutation({
    mutationFn: (id: string) => deleteOfferingSubcategory(id, user!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offering-subcategories"] });
      toast.success("ลบหมวดย่อยแล้ว");
    },
  });

  // UI state
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#F97316");
  const [editingCat, setEditingCat] = useState<{ id: string; name: string; color: string } | null>(
    null,
  );
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [newSubForCat, setNewSubForCat] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [editingSub, setEditingSub] = useState<{ id: string; name: string } | null>(null);
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);

  const PRESET_COLORS = [
    "#F97316",
    "#EAB308",
    "#22C55E",
    "#0EA5E9",
    "#A855F7",
    "#F59E0B",
    "#EC4899",
    "#14B8A6",
    "#EF4444",
    "#6366F1",
  ];

  const subsForCat = (catId: string) =>
    allSubs.filter((s) => s.categoryId === catId).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <PageHeader kicker="ระบบ" title="ตั้งค่า" description="ตั้งค่าระบบและจัดการหมวดหมู่" />

      {/* ── ข้อมูลระบบ ── */}
      <Card className=" max-w-2xl">
        <CardHeader>
          <CardTitle>ข้อมูลระบบ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ข้อมูลทั้งหมดจัดเก็บใน Supabase Cloud Database พร้อมระบบ Audit Trail แบบ SHA-256 Hash
            Chain
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-md">
            <ShieldCheck className="h-4 w-4 text-success" />
            หากต้องการรีเซ็ตข้อมูล กรุณาติดต่อผู้ดูแลระบบ
          </div>
        </CardContent>
      </Card>

      {/* ── จัดการหมวดหมู่เงินถวาย ── */}
      <Card className=" max-w-2xl mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>จัดการหมวดหมู่เงินถวาย</CardTitle>
          <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="">
                <Plus className="h-4 w-4 mr-1" /> เพิ่มหมวดหมู่
              </Button>
            </DialogTrigger>
            <DialogContent className="">
              <DialogHeader>
                <DialogTitle>เพิ่มหมวดหมู่ใหม่</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>ชื่อหมวดหมู่</Label>
                  <Input
                    className="mt-1.5"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="เช่น ทีมสื่อ"
                  />
                </div>
                <div>
                  <Label>สี</Label>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className={`w-8 h-8 rounded-full border-2 ${newCatColor === c ? "border-foreground" : "border-transparent"} transition`}
                        style={{ backgroundColor: c }}
                        aria-label={`เลือกสี ${c}`}
                        aria-pressed={newCatColor === c}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setNewCatOpen(false)}>
                  ยกเลิก
                </Button>
                <Button
                  onClick={() => {
                    if (newCatName.trim()) {
                      createCat.mutate({ name: newCatName.trim(), color: newCatColor });
                      setNewCatName("");
                      setNewCatOpen(false);
                    }
                  }}
                  disabled={!newCatName.trim() || createCat.isPending}
                >
                  บันทึก
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">ยังไม่มีหมวดหมู่</p>
          ) : (
            <div className="divide-y">
              {categories
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((cat) => {
                  const subs = subsForCat(cat.id);
                  const expanded = expandedCat === cat.id;
                  return (
                    <div key={cat.id}>
                      {/* Category row */}
                      <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/30">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setExpandedCat(expanded ? null : cat.id)}
                            aria-label={expanded ? "ย่อหมวดหมู่ย่อย" : "ขยายหมวดหมู่ย่อย"}
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <span
                            className="inline-block w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span
                            className={`text-sm font-medium truncate ${!cat.isActive ? "text-muted-foreground line-through" : ""}`}
                          >
                            {cat.name}
                          </span>
                          {!cat.isActive && (
                            <Badge
                              variant="outline"
                              className="rounded-full text-[10px] text-muted-foreground"
                            >
                              ปิด
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateCat.mutate({ id: cat.id, isActive: !cat.isActive })
                            }
                            aria-label="toggle"
                          >
                            {cat.isActive ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditingCat({ id: cat.id, name: cat.name, color: cat.color })
                            }
                            aria-label="edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteCatId(cat.id)}
                            aria-label="delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Subcategories (expanded) */}
                      {expanded && (
                        <div className="bg-muted/20 px-5 py-2 space-y-1">
                          {subs.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between py-1.5 pl-9"
                            >
                              <span
                                className={`text-sm ${!sub.isActive ? "text-muted-foreground line-through" : ""}`}
                              >
                                {sub.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    updateSub.mutate({ id: sub.id, isActive: !sub.isActive })
                                  }
                                  aria-label="toggle"
                                  className="h-7 w-7"
                                >
                                  {sub.isActive ? (
                                    <Eye className="h-3.5 w-3.5" />
                                  ) : (
                                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingSub({ id: sub.id, name: sub.name })}
                                  aria-label="edit"
                                  className="h-7 w-7"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteSubId(sub.id)}
                                  aria-label="delete"
                                  className="h-7 w-7"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="pl-9 pt-1">
                            <Dialog
                              open={newSubForCat === cat.id}
                              onOpenChange={(v) => {
                                if (!v) setNewSubForCat(null);
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl text-xs h-8"
                                  onClick={() => setNewSubForCat(cat.id)}
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" /> เพิ่มประเภทย่อย
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="">
                                <DialogHeader>
                                  <DialogTitle>เพิ่มประเภทย่อยใน "{cat.name}"</DialogTitle>
                                </DialogHeader>
                                <div>
                                  <Label>ชื่อประเภทย่อย</Label>
                                  <Input
                                    className="mt-1.5"
                                    value={newSubName}
                                    onChange={(e) => setNewSubName(e.target.value)}
                                    placeholder="เช่น ทีมกราฟิก"
                                  />
                                </div>
                                <DialogFooter>
                                  <Button variant="ghost" onClick={() => setNewSubForCat(null)}>
                                    ยกเลิก
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (newSubName.trim()) {
                                        createSub.mutate({
                                          categoryId: cat.id,
                                          name: newSubName.trim(),
                                        });
                                        setNewSubName("");
                                        setNewSubForCat(null);
                                      }
                                    }}
                                    disabled={!newSubName.trim() || createSub.isPending}
                                  >
                                    บันทึก
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Category Dialog ── */}
      <Dialog
        open={!!editingCat}
        onOpenChange={(v) => {
          if (!v) setEditingCat(null);
        }}
      >
        <DialogContent className="">
          <DialogHeader>
            <DialogTitle>แก้ไขหมวดหมู่</DialogTitle>
          </DialogHeader>
          {editingCat && (
            <div className="space-y-4">
              <div>
                <Label>ชื่อหมวดหมู่</Label>
                <Input
                  className="mt-1.5"
                  value={editingCat.name}
                  onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                />
              </div>
              <div>
                <Label>สี</Label>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingCat({ ...editingCat, color: c })}
                      className={`w-8 h-8 rounded-full border-2 ${editingCat.color === c ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      aria-label={`เลือกสี ${c}`}
                      aria-pressed={editingCat.color === c}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingCat(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                if (editingCat && editingCat.name.trim()) {
                  updateCat.mutate({
                    id: editingCat.id,
                    name: editingCat.name.trim(),
                    color: editingCat.color,
                  });
                  setEditingCat(null);
                }
              }}
              disabled={!editingCat?.name.trim() || updateCat.isPending}
            >
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Subcategory Dialog ── */}
      <Dialog
        open={!!editingSub}
        onOpenChange={(v) => {
          if (!v) setEditingSub(null);
        }}
      >
        <DialogContent className="">
          <DialogHeader>
            <DialogTitle>แก้ไขประเภทย่อย</DialogTitle>
          </DialogHeader>
          {editingSub && (
            <div>
              <Label>ชื่อประเภทย่อย</Label>
              <Input
                className="mt-1.5"
                value={editingSub.name}
                onChange={(e) => setEditingSub({ ...editingSub, name: e.target.value })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingSub(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                if (editingSub && editingSub.name.trim()) {
                  updateSub.mutate({ id: editingSub.id, name: editingSub.name.trim() });
                  setEditingSub(null);
                }
              }}
              disabled={!editingSub?.name.trim() || updateSub.isPending}
            >
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmations ── */}
      <AlertDialog
        open={!!deleteCatId}
        onOpenChange={(v) => {
          if (!v) setDeleteCatId(null);
        }}
      >
        <AlertDialogContent className="">
          <AlertDialogHeader>
            <AlertDialogTitle>ลบหมวดหมู่?</AlertDialogTitle>
            <AlertDialogDescription>
              เงินถวายในหมวดนี้จะถูกย้ายไปหมวด "อื่น ๆ" การดำเนินการนี้ไม่สามารถย้อนกลับ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteCatId) deleteCat.mutate(deleteCatId);
                setDeleteCatId(null);
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteSubId}
        onOpenChange={(v) => {
          if (!v) setDeleteSubId(null);
        }}
      >
        <AlertDialogContent className="">
          <AlertDialogHeader>
            <AlertDialogTitle>ลบประเภทย่อย?</AlertDialogTitle>
            <AlertDialogDescription>
              เงินถวายที่ใช้ประเภทย่อยนี้จะไม่ระบุประเภทย่อยอีกต่อไป
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteSubId) deleteSub.mutate(deleteSubId);
                setDeleteSubId(null);
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
