import { ChefXPLogo } from "@/components/ChefXPLogo";

/**
 * A barra de cima.
 *
 * Tinha um sino de notificações e um ícone de mensagens, os dois sem nada por
 * trás — não há sistema de notificações nem de mensagens neste projeto. Um
 * botão que não faz nada não é um espaço reservado: é uma promessa por
 * cumprir, e quem carrega nele fica a pensar que a app está avariada.
 *
 * Voltam no dia em que houver o que mostrar lá dentro.
 */
export function TopHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-lg items-center px-4">
        <ChefXPLogo />
      </div>
    </header>
  );
}
