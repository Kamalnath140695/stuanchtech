import React, {
  useState,
  useEffect,
  useRef
} from 'react';
import {
  AddRegular, ArrowUploadRegular,
  FolderRegular, DocumentRegular,
  SaveRegular, DeleteRegular,
} from '@fluentui/react-icons';
import {
  Button, Link, Label, Spinner,
  Input, InputProps, InputOnChangeData,
  Dialog, DialogActions, DialogContent, DialogBody, DialogSurface, DialogTitle, DialogTrigger,
  DataGrid, DataGridProps,
  DataGridHeader, DataGridHeaderCell,
  DataGridBody, DataGridRow,
  DataGridCell,
  TableColumnDefinition, createTableColumn,
  TableRowId,
  TableCellLayout,
  OnSelectionChangeData,
  SelectionItemId,
  Toolbar, ToolbarButton,
  makeStyles
} from "@fluentui/react-components";
import { DriveItem } from "@microsoft/microsoft-graph-types-beta";
import { IContainer } from "./../common/IContainer";
import PermissionError, { IApiError } from './PermissionError';
import * as Constants from './../common/constants';
import { apiFetch } from '../services/api';
import { useRBAC } from '../context/RBACContext';

interface IFilesProps {
  container: IContainer;
}

interface IDriveItemExtended extends DriveItem {
  isFolder: boolean;
  modifiedByName: string;
  iconElement: React.ReactElement;
  downloadUrl: string;
}

const useStyles = makeStyles({
  dialogInputControl: {
    width: '400px',
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '10px',
    marginBottom: '25px'
  }
});

export const Files = (props: IFilesProps) => {
  const styles = useStyles();

  const [driveItems, setDriveItems] = useState<IDriveItemExtended[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<SelectionItemId>>(new Set<TableRowId>([1]));
  const [apiError, setApiError] = useState<IApiError | null>(null);

  const [folderId, setFolderId] = useState<string>('root');
  const [folderName, setFolderName] = useState<string>('');
  const [creatingFolder, setCreatingFolder] = useState<boolean>(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const uploadFileRef = useRef<HTMLInputElement>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]);

  const loadItems = async (itemId?: string) => {
    setApiError(null);
    try {
      const driveId = props.container.id;
      const url = itemId
        ? `${Constants.API_SERVER_URL}/api/files/list?containerId=${driveId}&itemId=${itemId}`
        : `${Constants.API_SERVER_URL}/api/files/list?containerId=${driveId}`;
      const response = await fetch(url);
      if (!response.ok) {
        const err = await response.json();
        const msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail ?? err);
        setApiError({ code: 'ACCESS_DENIED', message: msg, detail: 'Access denied', contactAdmin: true });
        return;
      }
      const containerItems: DriveItem[] = await response.json();
      const items: IDriveItemExtended[] = containerItems.map((driveItem: DriveItem) => ({
        ...driveItem,
        isFolder: !!driveItem.folder,
        modifiedByName: driveItem.lastModifiedBy?.user?.displayName ?? 'unknown',
        iconElement: driveItem.folder ? <FolderRegular /> : <DocumentRegular />,
        downloadUrl: (driveItem as any)['@microsoft.graph.downloadUrl']
      }));
      setDriveItems(items);
    } catch (error: any) {
      setApiError({ code: 'SERVER_ERROR', message: `Failed to load items: ${error.message}`, contactAdmin: true });
    }
  };

  const onFolderCreateClick = async () => {
    setCreatingFolder(true);
    const currentFolderId = folderId;
    const response = await fetch(`${Constants.API_SERVER_URL}/api/files/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId: props.container.id, parentId: currentFolderId, name: folderName })
    });
    if (response.ok) await loadItems(currentFolderId === 'root' ? undefined : currentFolderId);
    setCreatingFolder(false);
    setNewFolderDialogOpen(false);
  };

  const onHandleFolderNameChange: InputProps["onChange"] = (event: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData): void => {
    setFolderName(data?.value);
  };

  const onSelectionChange: DataGridProps["onSelectionChange"] = (event: React.MouseEvent | React.KeyboardEvent,
                                                                 data: OnSelectionChangeData): void => {
    setSelectedRows(data.selectedItems);
  };

  const onDownloadItemClick = (downloadUrl: string) => {
    const link = downloadLinkRef.current;
    link!.href = downloadUrl;
    link!.click();
  };

  const onUploadFileClick = () => {
    if (uploadFileRef.current) {
      uploadFileRef.current.click();
    }
  };

  const onUploadFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files![0];
    const formData = new FormData();
    formData.append('containerId', props.container.id);
    formData.append('parentId', folderId || 'root');
    formData.append('file', file);
    try {
      await apiFetch(`/api/files/upload`, {
        method: 'POST',
        body: formData
      });
      await loadItems(folderId === 'root' ? undefined : folderId);
    } catch (e: any) {
      setApiError({ code: 'SERVER_ERROR', message: e.message, contactAdmin: true });
    }
  };

  const onDeleteItemClick = async () => {
    const itemId = selectedRows.entries().next().value?.[0] ?? '';
    try {
      await apiFetch(`/api/files/delete?containerId=${props.container.id}&itemId=${itemId}`, { method: 'DELETE' });
      await loadItems(folderId === 'root' ? undefined : folderId);
    } catch (e: any) {
      setApiError({ code: 'SERVER_ERROR', message: e.message, contactAdmin: true });
    }
    setDeleteDialogOpen(false);
  };

  const columns: TableColumnDefinition<IDriveItemExtended>[] = [
    createTableColumn({
      columnId: 'driveItemName',
      renderHeaderCell: () => {
        return 'Name'
      },
      renderCell: (driveItem) => {
        return (
          <TableCellLayout media={driveItem.iconElement}>
            {(!driveItem.isFolder)
              ? <Link href={driveItem.downloadUrl} target='_blank'>{driveItem.name}</Link>
              : <Link onClick={() => {
                loadItems(driveItem.id);
                setFolderId(driveItem.id as string)
              }}>{driveItem.name}</Link>
            }
          </TableCellLayout>
        )
      }
    }),
    createTableColumn({
      columnId: 'lastModifiedTimestamp',
      renderHeaderCell: () => {
        return 'Last Modified'
      },
      renderCell: (driveItem) => {
        return (
          <TableCellLayout>
            {driveItem.lastModifiedDateTime}
          </TableCellLayout>
        )
      }
    }),
    createTableColumn({
      columnId: 'lastModifiedBy',
      renderHeaderCell: () => {
        return 'Last Modified By'
      },
      renderCell: (driveItem) => {
        return (
          <TableCellLayout>
            {driveItem.modifiedByName}
          </TableCellLayout>
        )
      }
    }),
    createTableColumn({
      columnId: 'actions',
      renderHeaderCell: () => {
        return 'Actions'
      },
      renderCell: (driveItem) => {
        return (
          <>
            <Button aria-label="Download"
              disabled={!selectedRows.has(driveItem.id as string)}
              icon={<SaveRegular />}
              onClick={() => onDownloadItemClick(driveItem.downloadUrl)}>Download</Button>
            {canDelete && (
              <Button aria-label="Delete"
                icon={<DeleteRegular />}
                onClick={() => setDeleteDialogOpen(true)}>Delete</Button>
            )}
          </>
        )
      }
    }),
  ];

  const columnSizingOptions = {
    driveItemName: {
      minWidth: 150,
      defaultWidth: 250,
      idealWidth: 200
    },
    lastModifiedTimestamp: {
      minWidth: 150,
      defaultWidth: 150
    },
    lastModifiedBy: {
      minWidth: 150,
      defaultWidth: 150
    },
    actions: {
      minWidth: 250,
      defaultWidth: 250
    }
  };

  const { role: appRole } = useRBAC();
  const cRole = props.container.userRole || 'reader';
  const isGlobal = appRole === 'GlobalAdmin';

  // write = upload files + create folders (owner, manager, writer, write OR GlobalAdmin)
  const canUpload = isGlobal || cRole === 'owner' || cRole === 'manager' || cRole === 'writer' || cRole === 'write';
  // delete = owner-level only OR GlobalAdmin
  const canDelete = isGlobal || cRole === 'owner';

  return (
    <div>
      {apiError && <PermissionError error={apiError} onDismiss={() => setApiError(null)} />}
      <input ref={uploadFileRef} type="file" onChange={onUploadFileSelected} style={{ display: 'none' }} />
      <a ref={downloadLinkRef} href="#" target="_blank" rel="noopener noreferrer" style={{ display: 'none' }}>Download Link</a>

      <Toolbar>
        {canUpload && (
          <>
            <ToolbarButton vertical icon={<AddRegular />} onClick={() => setNewFolderDialogOpen(true)}>New Folder</ToolbarButton>
            <ToolbarButton vertical icon={<ArrowUploadRegular />} onClick={onUploadFileClick}>Upload File</ToolbarButton>
          </>
        )}
      </Toolbar>

      <Dialog open={newFolderDialogOpen}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <Label htmlFor={folderName}>Folder name:</Label>
              <Input id={folderName} className={styles.dialogInputControl} autoFocus required
                value={folderName} onChange={onHandleFolderNameChange}></Input>
              {creatingFolder &&
                <Spinner size='medium' label='Creating folder...' labelPosition='after' />
              }
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" onClick={() => setNewFolderDialogOpen(false)} disabled={creatingFolder}>Cancel</Button>
              </DialogTrigger>
              <Button appearance="primary"
                onClick={onFolderCreateClick}
                disabled={creatingFolder || (folderName === '')}>Create Folder</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={deleteDialogOpen} modalType='modal' onOpenChange={() => setSelectedRows(new Set<TableRowId>([0]))}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogContent>
              <p>Are you sure you want to delete this item?</p>
            </DialogContent>
            <DialogActions>
              <DialogTrigger>
                <Button
                  appearance='secondary'
                  onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              </DialogTrigger>
              <Button
                appearance='primary'
                onClick={onDeleteItemClick}>Delete</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <DataGrid
        items={driveItems}
        columns={columns}
        getRowId={(item) => item.id}
        resizableColumns
        columnSizingOptions={columnSizingOptions}
        selectionMode='single'
        selectedItems={selectedRows}
        onSelectionChange={onSelectionChange}>
        <DataGridHeader>
          <DataGridRow>
            {({ renderHeaderCell }) => (
              <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
            )}
          </DataGridRow>
        </DataGridHeader>
        <DataGridBody<IDriveItemExtended>>
          {({ item, rowId }) => (
            <DataGridRow<IDriveItemExtended> key={rowId}>
              {({ renderCell, columnId }) => (
                <DataGridCell>
                  {renderCell(item)}
                </DataGridCell>
              )}
            </DataGridRow>
          )}
        </DataGridBody>
      </DataGrid>
    </div>
  );
}

export default Files;
