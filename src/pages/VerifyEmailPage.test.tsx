import { describe, expect, test, vi } from "vitest";
import { StrictMode } from "react";
import { screen } from "@testing-library/react";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { renderWithProviders } from "@/test/utils";

const confirmar = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth/services/authService", () => ({
  authService: { verifyEmail: confirmar },
}));

/**
 * Um token diferente por teste.
 *
 * A chave da query inclui o token, portanto tokens iguais em testes
 * diferentes partilhavam entrada na cache — e um teste passava a depender do
 * que o anterior lá deixou.
 */
/** A resposta demora um pouco, como na rede, e não resolve no mesmo instante. */
function responde<T>(valor: T) {
  return () => new Promise<T>((resolve) => setTimeout(() => resolve(valor), 20));
}

let contador = 0;
const proximoToken = () => String(contador++).padStart(64, "a");

/**
 * Este ecrã confirma sozinho ao abrir, e os testes correm dentro de
 * `StrictMode` porque é assim que a app corre em desenvolvimento.
 *
 * Aviso a quem vier a seguir: estes testes **não** apanham a avaria que este
 * ecrã já teve — ficar em "A confirmar…" para sempre com a primeira versão,
 * que disparava uma mutação num `useEffect` de arranque. Tentou-se: com
 * `StrictMode`, com atraso na resposta, e a versão avariada passa à mesma. O
 * jsdom não reproduz a corrida que o browser tem. Quem mexer neste ecrã
 * verifica-o num browser a sério, não só aqui.
 */
describe("confirmar o email pelo link", () => {
  const abrir = (rota: string) =>
    renderWithProviders(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
      { route: rota },
    );

  /**
   * O caso de erro corre sem `StrictMode`, e só ele.
   *
   * Com o ciclo de montar-desmontar-montar, a promessa rejeitada do primeiro
   * arranque fica sem observador e o Vitest acusa-a como rejeição não tratada
   * — um artefacto do teste, não um defeito do ecrã. O que o `StrictMode`
   * protege é o caminho de sucesso, que é onde a primeira versão se perdia.
   */
  const abrirSemStrictMode = (rota: string) =>
    renderWithProviders(<VerifyEmailPage />, { route: rota });

  test("um link válido acaba em email confirmado", async () => {
    confirmar.mockReset();
    confirmar.mockImplementation(responde({ ok: true, alreadyVerified: false }));
    const token = proximoToken();
    abrir(`/verify-email?token=${token}`);

    expect(await screen.findByText(/email confirmed/i)).toBeInTheDocument();
  });

  test("a rota é chamada uma vez, e não duas por causa do StrictMode", async () => {
    confirmar.mockReset();
    confirmar.mockImplementation(responde({ ok: true, alreadyVerified: false }));
    const token = proximoToken();
    abrir(`/verify-email?token=${token}`);

    await screen.findByText(/email confirmed/i);
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenCalledWith(token);
  });

  test("abrir o mesmo link outra vez não é erro nenhum", async () => {
    confirmar.mockReset();
    confirmar.mockImplementation(responde({ ok: true, alreadyVerified: true }));
    const token = proximoToken();
    abrir(`/verify-email?token=${token}`);

    expect(await screen.findByRole("heading", { name: /already confirmed/i })).toBeInTheDocument();
  });

  test("um token recusado mostra o erro do servidor", async () => {
    // `() => Promise.reject(...)` e não `mockRejectedValue(...)`: este último
    // constrói a promessa rejeitada no momento em que se prepara o teste,
    // antes de haver quem a apanhe, e o Vitest acusa-a como rejeição não
    // tratada. Assim, a rejeição só nasce quando o ecrã chama a rota.
    confirmar.mockReset();
    confirmar.mockImplementation(() =>
      Promise.reject(new Error("Invalid or expired link. Ask for another.")),
    );
    abrirSemStrictMode(`/verify-email?token=${proximoToken()}`);

    expect(await screen.findByText(/couldn't confirm/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid or expired link/i)).toBeInTheDocument();
  });

  test("sem token no endereço, nem se chega a chamar a rota", () => {
    confirmar.mockReset();
    abrir("/verify-email");

    expect(screen.getByText(/incomplete link/i)).toBeInTheDocument();
    expect(confirmar).not.toHaveBeenCalled();
  });
});
