import { getSupabaseClient } from "./lib/supabase/client";
import { ChurchSetupPage } from "./pages/ChurchSetupPage";

const supabase = getSupabaseClient();
let mounted = false;

async function mount(): Promise<void> {
  const isSetup = window.location.hash === "#/setup" || new URLSearchParams(window.location.search).get("setup") === "1";
  if (!isSetup || mounted) return;
  const root = document.getElementById("app");
  if (!root) return;
  mounted = true;

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) { mounted = false; return; }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile?.church_id) { root.innerHTML = `<main class="gl-setup-page"><div class="gl-setup-card"><h1>ยังไม่พบคริสตจักร</h1><p>บัญชีนี้ยังไม่ได้ผูกกับคริสตจักร</p></div></main>`; return; }

  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("church_id", profile.church_id).limit(1).maybeSingle();
  if (!role || !["super_admin", "pastor", "treasurer"].includes(role.role)) {
    root.innerHTML = `<main class="gl-setup-page"><div class="gl-setup-card"><h1>ไม่มีสิทธิ์</h1><p>เฉพาะผู้ดูแลคริสตจักร เหรัญญิก หรือศิษยาภิบาลเท่านั้นที่ตั้งค่าคริสตจักรได้</p><a class="gl-btn gl-btn-primary" href="#/">กลับแดชบอร์ด</a></div></main>`;
    return;
  }

  const page = new ChurchSetupPage(supabase, profile.church_id);
  await page.load();
  root.innerHTML = page.renderHtml();
  page.attachEventListeners(root, () => { window.location.hash = "#/"; window.location.reload(); });
}

window.addEventListener("hashchange", () => { mounted = false; void mount(); });
window.addEventListener("load", () => void mount());
void mount();
