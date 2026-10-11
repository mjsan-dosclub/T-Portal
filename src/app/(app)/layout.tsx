import { AuthWatcher } from "@/components/auth-watcher";
import { ToastProvider } from "@/components/toast";
import { requirePageAdmin } from "@/server/page-auth";
import { Nav } from "./nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const admin = await requirePageAdmin();
  return (
    <ToastProvider>
      <AuthWatcher />
      <a href="#main" className="sr-only" style={{ position: "absolute" }}>
        Skip to content
      </a>
      <div className="shell">
        <Nav role={admin.role} name={admin.name} />
        <main id="main" className="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
