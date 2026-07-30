import type { UserProfile } from "@terrativa/protocol";
import type { FormEvent } from "react";
import { useState } from "react";
import { login, register } from "./api";

export type AuthMode = "login" | "register";

interface AuthDialogProps {
  readonly mode: AuthMode;
  readonly onAuthenticated: (user: UserProfile) => void;
  readonly onClose: () => void;
  readonly onModeChange: (mode: AuthMode) => void;
}

const errorMessages: Record<string, string> = {
  "auth.identityUnavailable": "E-mail ou nome de jogador indisponível.",
  "auth.invalidCredentials": "E-mail ou senha inválidos.",
  "auth.tooManyAttempts": "Muitas tentativas. Aguarde um pouco e tente novamente.",
  "request.invalidPayload": "Confira os campos informados.",
  "server.internalError": "Não foi possível concluir agora. Tente novamente.",
};

export function AuthDialog({ mode, onAuthenticated, onClose, onModeChange }: AuthDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegistration = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const auth = isRegistration
        ? await register({
            email: String(form.get("email") ?? ""),
            username: String(form.get("username") ?? ""),
            displayName: String(form.get("displayName") ?? ""),
            password: String(form.get("password") ?? ""),
          })
        : await login({
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          });
      onAuthenticated(auth.user);
    } catch (cause) {
      const messageKey = cause instanceof Error ? cause.message : "server.internalError";
      setError(errorMessages[messageKey] ?? errorMessages["server.internalError"] ?? "");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-overlay" role="presentation">
      <section aria-labelledby="auth-title" aria-modal="true" className="auth-dialog" role="dialog">
        <button aria-label="Fechar" className="auth-dialog__close" onClick={onClose} type="button">
          ×
        </button>
        <div className="eyebrow">
          {isRegistration ? "Sua jornada começa aqui" : "Bem-vindo de volta"}
        </div>
        <h2 id="auth-title">{isRegistration ? "Criar conta" : "Entrar na Terrativa"}</h2>
        <p>
          {isRegistration
            ? "Crie sua identidade de jogador para explorar a Baixada Santista."
            : "Continue desenvolvendo seu território com segurança."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegistration && (
            <>
              <label>
                Nome de jogador
                <input
                  autoComplete="username"
                  minLength={3}
                  name="username"
                  pattern="[A-Za-z0-9_]+"
                  required
                />
              </label>
              <label>
                Nome de exibição
                <input autoComplete="name" minLength={2} name="displayName" required />
              </label>
            </>
          )}
          <label>
            E-mail
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label>
            Senha
            <input
              autoComplete={isRegistration ? "new-password" : "current-password"}
              minLength={isRegistration ? 12 : 1}
              name="password"
              required
              type="password"
            />
          </label>
          {error && (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          )}
          <button className="auth-form__submit" disabled={submitting} type="submit">
            {submitting ? "Conectando…" : isRegistration ? "Começar jornada" : "Entrar"}
          </button>
        </form>

        <button
          className="auth-dialog__switch"
          onClick={() => onModeChange(isRegistration ? "login" : "register")}
          type="button"
        >
          {isRegistration ? "Já tenho uma conta" : "Quero criar uma conta"}
        </button>
        <small>Seus recursos e propriedades são sempre fictícios.</small>
      </section>
    </div>
  );
}
