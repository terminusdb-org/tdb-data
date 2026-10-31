import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { dismissNotification, selectNotifications, type AppNotification } from "@/store/notificationSlice";

const severityStyles: Record<AppNotification["severity"], string> = {
  error: "border-red-400 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200",
  warning:
    "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  info: "border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  success:
    "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
};

function Toast({ notification }: { notification: AppNotification }) {
  const dispatch = useAppDispatch();
  const transient = notification.severity === "info" || notification.severity === "success";

  useEffect(() => {
    if (!transient) return;
    const timer = setTimeout(() => dispatch(dismissNotification({ id: notification.id })), 6000);
    return () => clearTimeout(timer);
  }, [dispatch, notification.id, transient]);

  return (
    <div
      role={notification.severity === "error" ? "alert" : "status"}
      className={`pointer-events-auto w-80 rounded-lg border p-3 shadow-lg ${severityStyles[notification.severity]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium">{notification.title}</div>
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded px-1 text-xs opacity-60 hover:opacity-100"
          onClick={() => dispatch(dismissNotification({ id: notification.id }))}
        >
          ✕
        </button>
      </div>
      {notification.message && <div className="mt-1 text-xs">{notification.message}</div>}
      {notification.detailsJson && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs opacity-70">Details</summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/5 p-2 text-[10px] whitespace-pre-wrap dark:bg-black/30">
            {notification.detailsJson}
          </pre>
        </details>
      )}
    </div>
  );
}

// Persistent error/warning toasts + auto-dismissing info/success, mounted once in DataLayout.
export function ToastStack() {
  const notifications = useAppSelector(selectNotifications);
  if (notifications.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {notifications.map((n) => (
        <Toast key={n.id} notification={n} />
      ))}
    </div>
  );
}
