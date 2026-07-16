import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      role="button"
      tabIndex={-1}
      aria-label={t("confirmDialog.closeDialog")}
    >
      <div
        className="max-w-md rounded-lg bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h2
          id="confirm-dialog-title"
          className="mb-2 text-lg font-semibold text-gray-900"
        >
          {title}
        </h2>
        <div className="mb-4 text-sm text-gray-600">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-dfrntBlue-600 hover:bg-dfrntBlue-700"
            }`}
          >
            {confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
