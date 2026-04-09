export interface ApiError {
  code: 'ACCESS_DENIED' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'SERVER_ERROR';
  message: string;
  detail?: string;
  contactAdmin: boolean;
}

export const classifyError = (error: any): ApiError => {
  const status = error?.statusCode || error?.status || 0;
  const code = error?.code || error?.errorCode || '';
  const msMessage = error?.body ? JSON.parse(error.body)?.error?.message : error?.message || 'An unexpected error occurred';

  if (status === 403 || code === 'accessDenied' || code === 'Authorization_RequestDenied') {
    return {
      code: 'ACCESS_DENIED',
      message: msMessage,
      detail: `Error code: ${code || status}. Please contact your administrator to grant the required permissions.`,
      contactAdmin: true
    };
  }

  if (status === 401 || code === 'InvalidAuthenticationToken' || code === 'unauthenticated') {
    return {
      code: 'UNAUTHORIZED',
      message: msMessage,
      detail: `Error code: ${code || status}. Your session may have expired, please sign in again.`,
      contactAdmin: false
    };
  }

  if (status === 404 || code === 'itemNotFound') {
    return {
      code: 'NOT_FOUND',
      message: msMessage,
      detail: `Error code: ${code || status}.`,
      contactAdmin: false
    };
  }

  return {
    code: 'SERVER_ERROR',
    message: msMessage,
    detail: `Error code: ${code || status}. Please contact your administrator if this persists.`,
    contactAdmin: true
  };
};
