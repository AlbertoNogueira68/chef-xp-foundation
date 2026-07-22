import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopHeader } from "./TopHeader";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background pb-[4.5rem]">
      <TopHeader />
      <main className="mx-auto max-w-lg px-3 py-3">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
