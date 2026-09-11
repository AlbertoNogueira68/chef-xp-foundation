import { Input } from "@/components/ui/input";

/**
 * Caixa para o código de seis dígitos.
 *
 * `inputMode="numeric"` e `autoComplete="one-time-code"`: no telemóvel abre o
 * teclado numérico e o sistema oferece o código do SMS ou do email sem obrigar
 * a sair da app para o ir copiar.
 */
export function CodeInput({
  value,
  onChange,
  disabled,
  id = "codigo",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Input
      id={id}
      value={value}
      // Só dígitos, e no máximo seis: colar um código com espaços à volta é
      // o mais natural do mundo e não pode dar erro.
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="000000"
      maxLength={6}
      disabled={disabled}
      aria-label="Código de seis dígitos"
      className="h-12 text-center font-mono text-2xl tracking-[0.4em]"
    />
  );
}
