import React from 'react';
import { MessageBar, MessageBarBody, MessageBarTitle, MessageBarActions, Button } from '@fluentui/react-components';
import { LockClosedRegular, PersonCallRegular } from '@fluentui/react-icons';

export interface IApiError {
  code: string;
  message: string;
  detail?: string;
  contactAdmin: boolean;
}

interface IPermissionErrorProps {
  error: IApiError;
  onDismiss?: () => void;
}

export const PermissionError = ({ error, onDismiss }: IPermissionErrorProps) => {
  const isAccessDenied = error.code === 'ACCESS_DENIED';
  const isUnauthorized = error.code === 'UNAUTHORIZED';
  const isSPEAccessDenied = error.code === 'SPE_ACCESS_DENIED';

  return (
    <MessageBar intent={(isAccessDenied || isUnauthorized || isSPEAccessDenied) ? 'error' : 'warning'} style={{ marginBottom: '16px' }}>
      <MessageBarBody>
        <MessageBarTitle>
          {isSPEAccessDenied && <><LockClosedRegular /> SharePoint Embedded Access Denied</>}
          {isAccessDenied && <><LockClosedRegular /> Access Denied</>}
          {isUnauthorized && 'Authentication Error'}
          {!isAccessDenied && !isUnauthorized && !isSPEAccessDenied && 'Error'}
        </MessageBarTitle>
        {error.message}
        {error.detail && (
          <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.8 }}>
            Details: {error.detail}
          </div>
        )}
        {isSPEAccessDenied && (
          <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: '1.5' }}>
            <strong>SPE Setup Required:</strong>
            <ul style={{ margin: '8px 0 0 16px', fontSize: '12px', lineHeight: '1.4' }}>
              <li>Verify CONTAINER_TYPE_ID in backend .env</li>
              <li>Ensure tenant has SharePoint Embedded license</li>
              <li>App registration needs <code>Sites.FullControl.All</code> (application permission)</li>
              <li>Check <a href="https://aka.ms/spe-setup" target="_blank" style={{ color: '#3b82f6' }}>SPE setup guide</a></li>
            </ul>
          </div>
        )}
        {error.contactAdmin && !isSPEAccessDenied && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PersonCallRegular />
            <span>
              Please contact your administrator to request access.
              {isAccessDenied && ' Your account does not have the required permissions for this resource.'}
            </span>
          </div>
        )}
      </MessageBarBody>
      {onDismiss && (
        <MessageBarActions>
          <Button appearance='transparent' onClick={onDismiss}>Dismiss</Button>
        </MessageBarActions>
      )}
    </MessageBar>
  );
};

export default PermissionError;
