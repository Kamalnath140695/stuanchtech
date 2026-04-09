import { Request, Response } from 'express';
import * as MSAL from '@azure/msal-node';
require('isomorphic-fetch');
import * as MSGraph from '@microsoft/microsoft-graph-client';
import { classifyError } from './errorHandler';

// Graph permission IDs
const GRAPH_APP_ID = '00000003-0000-0000-c000-000000000000';
const SHAREPOINT_APP_ID = '00000003-0000-0ff1-ce00-000000000000';
const FILE_STORAGE_CONTAINER_SELECTED_DELEGATED = 'b2d9d3b0-e6e5-4b5e-b9b5-b6b9b6b9b6b9';

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

// GET /api/apps - list all app registrations created by this service
export const listApps = async (req: Request, res: Response) => {
  try {
    const graphClient = await getAppOnlyGraphClient();
    const response = await graphClient.api('/applications')
      .select('id,appId,displayName,createdDateTime,signInAudience')
      .top(50)
      .get();
    res.status(200).json(response.value);
  } catch (error: any) {
    const apiError = classifyError(error);
    res.status(apiError.code === 'ACCESS_DENIED' ? 403 : 500).json(apiError);
  }
};

// POST /api/apps - create app + service principal
export const createApp = async (req: Request, res: Response) => {
  try {
    const { displayName } = req.body;
    if (!displayName) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'displayName is required', contactAdmin: false });
      return;
    }

    const graphClient = await getAppOnlyGraphClient();

    // Step 1: Create app registration
    const app = await graphClient.api('/applications').post({
      displayName,
      signInAudience: 'AzureADMyOrg'
    });

    // Step 2: Create service principal
    const sp = await graphClient.api('/servicePrincipals').post({
      appId: app.appId
    });

    res.status(200).json({ app, servicePrincipal: sp });
  } catch (error: any) {
    const apiError = classifyError(error);
    res.status(apiError.code === 'ACCESS_DENIED' ? 403 : 500).json(apiError);
  }
};

// DELETE /api/apps?appObjectId=xxx - delete app registration
export const deleteApp = async (req: Request, res: Response) => {
  try {
    const appObjectId = req.query.appObjectId as string;
    if (!appObjectId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'appObjectId is required', contactAdmin: false });
      return;
    }
    const graphClient = await getAppOnlyGraphClient();
    await graphClient.api(`/applications/${appObjectId}`).delete();
    res.status(204).send();
  } catch (error: any) {
    const apiError = classifyError(error);
    res.status(apiError.code === 'ACCESS_DENIED' ? 403 : 500).json(apiError);
  }
};

// POST /api/apps/container-permission - assign container access to an app
export const assignContainerPermissionToApp = async (req: Request, res: Response) => {
  try {
    const { containerId, appId, role } = req.body;
    if (!containerId || !appId || !role) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'containerId, appId and role are required', contactAdmin: false });
      return;
    }

    const graphClient = await getAppOnlyGraphClient();

    const tenantId = process.env['API_ENTRA_APP_AUTHORITY']!.split('/').pop();
    const loginName = `i:0i.t|00000003-0000-0ff1-ce00-000000000000|${appId}@${tenantId}`;

    const response = await graphClient
      .api(`/storage/fileStorage/containers/${encodeURIComponent(containerId)}/permissions`)
      .post({
        roles: [role],
        grantedToV2: { siteUser: { loginName } }
      });

    res.status(200).json(response);
  } catch (error: any) {
    const apiError = classifyError(error);
    res.status(500).json({ ...apiError, _raw: error?.body || error?.message });
  }
};
