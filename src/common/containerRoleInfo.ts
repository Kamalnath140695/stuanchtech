export type FileStorageContainerRole = 'reader' | 'writer' | 'manager' | 'owner';

export interface FileStorageContainerRoleInfo {
  label: string;
  dropdownLabel: string;
  description: string;
}

export const FILE_STORAGE_CONTAINER_ROLE_ORDER: FileStorageContainerRole[] = [
  'reader',
  'writer',
  'manager',
  'owner',
];

export const FILE_STORAGE_CONTAINER_ROLES: Record<FileStorageContainerRole, FileStorageContainerRoleInfo> = {
  reader: {
    label: 'Reader',
    dropdownLabel: 'Reader (Read metadata and contents)',
    description: 'Readers can read fileStorageContainer metadata and the contents inside.',
  },
  writer: {
    label: 'Writer',
    dropdownLabel: 'Writer (Modify metadata and contents)',
    description: 'Writers can read and modify fileStorageContainer metadata and contents inside.',
  },
  manager: {
    label: 'Manager',
    dropdownLabel: 'Manager (Manage permissions)',
    description: 'Managers can read and modify fileStorageContainer metadata and contents inside and manage the permissions to the container.',
  },
  owner: {
    label: 'Owner',
    dropdownLabel: 'Owner (Full control)',
    description: 'Owners can read and modify fileStorageContainer metadata and contents inside, manage container permissions, and delete and restore containers.',
  },
};
