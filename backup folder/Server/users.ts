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
    defaultVersion: 'v1.0'
  });
};

// GET /api/users?search=<optional>
export const listUsers = async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const graphClient = await getAppOnlyGraphClient();

    let api = graphClient.api('/users')
      .select('id,displayName,userPrincipalName,mail')
      .filter("userType eq 'Member'")
      .top(50)
      .header('ConsistencyLevel', 'eventual');

    if (search) {
      api = graphClient.api('/users')
        .select('id,displayName,userPrincipalName,mail')
        .header('ConsistencyLevel', 'eventual')
        .search(`"displayName:${search}" OR "userPrincipalName:${search}"`)
        .top(50);
    }

    const response = await api.get();
    res.status(200).json(response.value);
  } catch (error: any) {
    const apiError = classifyError(error);
    res.status(apiError.code === 'ACCESS_DENIED' ? 403 : 500).json(apiError);
  }
};
