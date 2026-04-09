import { Request, Response, NextFunction } from 'express';
import * as MSAL from '@azure/msal-node';
import * as MSGraph from '@microsoft/microsoft-graph-client';
import * as Scopes from './scopes';

const msalConfig: MSAL.Configuration = {
  auth: {
    clientId: process.env['API_ENTRA_APP_CLIENT_ID']!,
    authority: process.env['API_ENTRA_APP_AUTHORITY']!,
    clientSecret: process.env['API_ENTRA_APP_CLIENT_SECRET']!
  }
};

const confidentialClient = new MSAL.ConfidentialClientApplication(msalConfig);

async function getGraphClient(req: Request): Promise<MSGraph.Client> {
  const [, token] = (req.headers.authorization || '').split(' ');

  const graphTokenRequest = {
    oboAssertion: token,
    scopes: [
      Scopes.GRAPH_SITES_READ_ALL,
      Scopes.SPEMBEDDED_FILESTORAGECONTAINER_SELECTED
    ]
  };

  const ccaOboResponse = await confidentialClient.acquireTokenOnBehalfOf(graphTokenRequest);
  const oboGraphToken = ccaOboResponse!.accessToken;

  const authProvider = (callback: MSGraph.AuthProviderCallback) => {
    callback(null, oboGraphToken);
  };

  return MSGraph.Client.init({
    authProvider: authProvider,
    defaultVersion: 'beta'
  });
}

export const listContainers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const graphClient = await getGraphClient(req);
    const graphResponse = await graphClient.api('storage/fileStorage/containers')
      .filter(`containerTypeId eq ${process.env['CONTAINER_TYPE_ID']}`)
      .get();
    res.status(200).json(graphResponse.value);
  } catch (error) {
    res.status(500).json({ message: `Failed to list containers: ${error}` });
  }
};

export const createContainer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { displayName, description } = req.body;
    const graphClient = await getGraphClient(req);

    const containerRequestData = {
      displayName: displayName,
      description: description,
      containerTypeId: process.env['CONTAINER_TYPE_ID']
    };

    const graphResponse = await graphClient.api('storage/fileStorage/containers')
      .post(containerRequestData);
    res.status(200).json(graphResponse);
  } catch (error) {
    res.status(500).json({ message: `Failed to create container: ${error}` });
  }
};
