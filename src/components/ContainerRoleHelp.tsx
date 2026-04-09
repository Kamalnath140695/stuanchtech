import React from 'react';
import { Button, Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components';
import { InfoRegular } from '@fluentui/react-icons';
import {
  FILE_STORAGE_CONTAINER_ROLE_ORDER,
  FILE_STORAGE_CONTAINER_ROLES,
  FileStorageContainerRole,
} from '../common/containerRoleInfo';

interface ContainerRoleHelpProps {
  roles?: FileStorageContainerRole[];
}

const ContainerRoleHelp: React.FC<ContainerRoleHelpProps> = ({ roles = FILE_STORAGE_CONTAINER_ROLE_ORDER }) => {
  return (
    <Popover withArrow positioning="below-start">
      <PopoverTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          size="small"
          icon={<InfoRegular />}
          aria-label="Show container role definitions"
          title="Show container role definitions"
          style={{ minWidth: 'auto', padding: '4px', height: '28px' }}
        />
      </PopoverTrigger>
      <PopoverSurface
        style={{
          maxWidth: '420px',
          padding: '14px 16px',
          borderRadius: '12px',
          border: '1px solid var(--phorexy-border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>Container role definitions</div>
          {roles.map((role) => {
            const info = FILE_STORAGE_CONTAINER_ROLES[role];
            return (
              <div key={role} style={{ fontSize: '12px', lineHeight: 1.5 }}>
                <strong>{info.label}</strong>: {info.description}
              </div>
            );
          })}
        </div>
      </PopoverSurface>
    </Popover>
  );
};

export default ContainerRoleHelp;
