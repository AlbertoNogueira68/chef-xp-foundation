import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopHeader } from "./TopHeader";
import { VerifyEmailBanner } from "@/components/account/VerifyEmailBanner";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background pb-[4.5rem]">
      <TopHeader />
      <main className="mx-auto max-w-lg space-y-3 px-3 py-3">
        {/* Fica no shell e não numa página: a conta por confirmar é um estado
            da pessoa, não de um ecrã. Desaparece sozinha assim que confirma. */}
        <VerifyEmailBanner />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
