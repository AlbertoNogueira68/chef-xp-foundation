import { Button } from "@/components/ui/button";

/**
 * O logótipo vai inline em SVG, não como imagem de um servidor da Google: a
 * CSP desta app é `defaultSrc 'self'` e carregar o ícone de fora obrigaria a
 * abri-la, exatamente o que o fluxo do lado do servidor evitou.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4z"
      />
      <path
        fill="#34A853"
        d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.8l7.3-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 9.9c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 3.3 30 1 24 1 15.4 1 7.9 5.9 4.3 13.2l7.3 5.7c1.7-5.2 6.6-9 12.4-9z"
      />
    </svg>
  );
}

/**
 * Uma navegação de página inteira, não um `fetch`: o servidor responde com um
 * redirecionamento para a Google, e é o browser que tem de o seguir.
 */
export function GoogleButton({ label = "Continuar com Google" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full rounded-full"
      onClick={() => {
        window.location.href = "/api/auth/google";
      }}
    >
      <GoogleMark className="size-4" />
      {label}
    </Button>
  );
}
