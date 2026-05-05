import { toast } from "sonner";

export const useToast = () => ({
  success: toast.success,
  error: toast.error,
  info: toast.info,
});
