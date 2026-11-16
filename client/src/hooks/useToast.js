import { useMemo } from 'react';
import toast from 'react-hot-toast';

const useToast = () => {
  return useMemo(
    () => ({
      success: (message) => toast.success(message),
      error: (message) => toast.error(message),
      info: (message) => toast(message),
      loading: (message) => toast.loading(message),
      dismiss: (id) => toast.dismiss(id),
    }),
    []
  );
};

export default useToast;
