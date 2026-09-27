import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopHeader } from "./TopHeader";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background pb-[4.5rem]">
      <TopHeader />
      <main className="mx-auto max-w-lg px-3 py-3">
        <Outlet />
      </main>
      <BottomNav />
      {/* Vive na casca e não numa página: quem entra pela primeira vez pode
          cair no feed, no perfil ou num link de receita, e a apresentação da
          app tem de aparecer na mesma. */}
      <WelcomeTour />
    </div>
  );
}
