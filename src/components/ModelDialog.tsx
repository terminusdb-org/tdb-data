import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Tailwind width class, e.g. "w-96". */
  widthClass?: string;
}

// Shared modal shell — Headless UI supplies the dialog role, aria-modal,
// focus trap, initial focus and Escape handling.
export function ModelDialog({ open, onClose, title, children, widthClass = "w-96" }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-40">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className={`max-h-[85vh] max-w-full overflow-y-auto rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900 ${widthClass}`}>
          <DialogTitle className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</DialogTitle>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
