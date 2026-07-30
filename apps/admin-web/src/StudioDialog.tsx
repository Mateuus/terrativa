import { type FormEvent, useEffect, useId, useRef, useState } from "react";

interface StudioTextDialogProps {
  readonly confirmLabel?: string;
  readonly description?: string;
  readonly initialValue: string;
  readonly inputLabel: string;
  readonly title: string;
  readonly onCancel: () => void;
  readonly onConfirm: (value: string) => void;
}

export function StudioTextDialog({
  confirmLabel = "Criar",
  description,
  initialValue,
  inputLabel,
  onCancel,
  onConfirm,
  title,
}: StudioTextDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const valid = value.trim().length > 0;

  useDialogKeyboard(onCancel);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) onConfirm(value.trim());
  }

  return (
    <div className="dialog-backdrop studio-dialog-backdrop" role="presentation">
      <form
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="studio-dialog"
        onSubmit={submit}
        role="dialog"
      >
        <header>
          <div>
            <span className="eyebrow">Terrativa Studio</span>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button aria-label="Fechar" className="icon-button" onClick={onCancel} type="button">
            ×
          </button>
        </header>
        <label className="studio-dialog-field">
          <span>{inputLabel}</span>
          <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <footer>
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className="admin-primary-button" disabled={!valid} type="submit">
            {confirmLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}

interface StudioConfirmDialogProps {
  readonly confirmLabel?: string;
  readonly description: string;
  readonly title: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function StudioConfirmDialog({
  confirmLabel = "Confirmar",
  description,
  onCancel,
  onConfirm,
  title,
}: StudioConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard(onCancel);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div className="dialog-backdrop studio-dialog-backdrop" role="presentation">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="studio-dialog is-confirm"
        role="alertdialog"
      >
        <header>
          <div>
            <span className="eyebrow">Confirmação</span>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button aria-label="Fechar" className="icon-button" onClick={onCancel} type="button">
            ×
          </button>
        </header>
        <footer>
          <button ref={cancelRef} className="secondary-button" onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className="danger-button studio-dialog-danger" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function useDialogKeyboard(onCancel: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);
}
