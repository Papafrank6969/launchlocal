export type StatusMessage = { type: "success" | "error"; text: string } | null;

export function FormStatus({ status, className = "" }: { status: StatusMessage; className?: string }) {
  if (!status) return null;
  return (
    <p
      role={status.type === "error" ? "alert" : "status"}
      className={`text-sm ${status.type === "success" ? "text-emerald-600" : "text-red-600"} ${className}`}
    >
      {status.text}
    </p>
  );
}

export function autoClearStatus(
  setStatus: (s: StatusMessage) => void,
  status: StatusMessage,
  ms = 3000,
) {
  setStatus(status);
  setTimeout(() => setStatus(null), ms);
}
