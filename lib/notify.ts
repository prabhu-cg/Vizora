import { toast } from "sonner";

/** Thin facade over the toast library so it can be replaced in one place. */
export const notify = {
  success: (message: string, description?: string) => toast.success(message, { description }),
  error: (message: string, description?: string) => toast.error(message, { description, duration: 8000 }),
  info: (message: string, description?: string) => toast(message, { description }),
};

export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
