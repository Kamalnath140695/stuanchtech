import { Request, Response } from 'express';
import * as MSAL from '@azure/msal-node';
require('isomorphic-fetch');
import * as MSGraph from '@microsoft/microsoft-graph-client';
import { classifyError } from './errorHandler';

const getConfidentialClient = () => new MSAL.ConfidentialClientApplication({
  auth: {
    clientId: process.env['API_ENTRA_APP_CLIENT_ID']!,
    authority: process.env['API_ENTRA_APP_AUTHORITY']!,
    clientSecret: process.env['API_ENTRA_APP_CLIENT_SECRET']!
  }
});

const getAppOnlyGraphClient = async (): Promise<MSGraph.Client> => {
  const confidentialClient = getConfidentialClient();
  const tokenResponse = await confidentialClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });
  return MSGraph.Client.init({
    authProvider: (callback) => callback(null, tokenResponse!.accessToken),
    defaultVersion: 'beta'
  });
};

const encodeContainerId = (id: string) => encodeURIComponent(id);

export const listContainerPermissions = async (req: Request, res: Response) => {
  try {
    const containerId = encodeContainerId(req.query.containerId as string);
    const graphClient = await getAppOnlyGraphClient();
    const response = await graphClient
      .api(`/storage/fileStorage/containers/${containerId}/permissions`)
      .get();
    res.status(200).json(response.value);
  } catch (error: any) {
    const apiError = classifyError(error);
    res.status(apiError.code === 'ACCESS_DENIED' ? 403 : apiError.code === 'NOT_FOUND' ? 404 : 500).json(apiError);
  }
};

export const addContainerPermission = async (req: Request, res: Response) => {
  try {
    const { containerId: rawContainerId, type, identifier, role } = req.body;
    if (!rawContainerId || !type || !identifier || !role) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'containerId, type, identifier and role are required', contactAdmin: false });
      return;
    }

    const graphClient = await getAppOnlyGraphClient();
    let grantedToV2: any;

    if (type === 'user') {
      // Resolve user by UPN to get their id first
      const userResponse = await graphClient.api(`/users/${encodeURIComponent(identifier)}`).select('id,displayName,userPrincipalName').get();
      grantedToV2 = {
        user: {
          id: userResponse.id,
          userPrincipalName: userResponse.userPrincipalName,
          displayName: userResponse.displayName
        }
      };
    } else if (type === 'app') {
      const tenantId = process.env['API_ENTRA_APP_AUTHORITY']!.split('/').pop();
      const loginName = `i:0i.t|00000003-0000-0ff1-ce00-000000000000|${identifier}@${tenantId}`;
      grantedToV2 = { siteUser: { loginName } };
    } else {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'type must be "user" or "app"', contactAdmin: false });
      return;
    }

    const containerId = encodeContainerId(rawContainerId);
    const response = await graphClient
      .api(`/storage/fileStorage/containers/${containerId}/permissions`)
      .post({ roles: [role], grantedToV2 });
    res.status(200).json(response);
  } catch (error: any) {
    const apiError = classifyError(error);
    res.status(apiError.code === 'ACCESS_DENIED' ? 403 : apiError.code === 'NOT_FOUND' ? 404 : 500).json(apiError);
  }
};

export const removeContainerPermission = async (req: Request, res: Response) => {
  try {
    const containerId = encodeContainerId(req.query.containerId as string);
    const permissionId = req.query.permissionId as string;
    const graphClient = await getAppOnlyGraphClient();
    await graphClient
      .api(`/storage/fileStorage/containers/${containerId}/permissions/${permissionId}`)
      .delete();
    res.status(204).send();
  } catch (error: any) {
    const apiError = classifyError(error);
    res.status(apiError.code === 'ACCESS_DENIED' ? 403 : apiError.code === 'NOT_FOUND' ? 404 : 500).json(apiError);
  }
};
