export type RuntimeErrorSource = "window.error" | "unhandledrejection" | "react.boundary";

export function sanitizeRuntimeMessage(input: unknown, maxLength = 1000) {
  return String(input ?? "Unknown runtime error")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(bearer\s+|token=|password=|authorization:)[^\s&]+/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function runtimeErrorFingerprint(source: string, message: string, path: string) {
  const value = `${source}|${message}|${path}`;
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 33) ^ value.charCodeAt(index);
  return `rt-${(hash >>> 0).toString(16)}`;
}
