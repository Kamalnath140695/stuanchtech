import { Request, Response } from 'express';
import * as MSAL from '@azure/msal-node';
require('isomorphic-fetch');
import * as MSGraph from '@microsoft/microsoft-graph-client';
import { getGraphToken } from './auth';
import { classifyError } from './errorHandler';

const getConfidentialClient = () => new MSAL.ConfidentialClientApplication({
  auth: {
    clientId: process.env['API_ENTRA_APP_CLIENT_ID']!,
    authority: process.env['API_ENTRA_APP_AUTHORITY']!,
    clientSecret: process.env['API_ENTRA_APP_CLIENT_SECRET']!
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel: any, message: any, containsPii: any) {
        console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: MSAL.LogLevel.Verbose,
    }
  }
});

export const createContainer = async (req: Request, res: Response) => {
  const confidentialClient = getConfidentialClient();
  if (!req.headers.authorization) {
    res.status(401).json({ message: 'No access token provided.' });
    return;
  }

  const [bearer, token] = (req.headers.authorization || '').split(' ');

  if (!req.body?.displayName) {
    res.status(400).json({ message: 'Invalid request: must provide a displayName property in the query parameters or request body' });
    return;
  }

  const [graphSuccess, graphTokenRequest] = await getGraphToken(confidentialClient, token);

  if (!graphSuccess) {
    res.status(200).json(graphTokenRequest);
    return;
  }

  const authProvider = (callback: MSGraph.AuthProviderCallback) => {
    callback(null, graphTokenRequest);
  };

  try {
    const graphClient = MSGraph.Client.init({
      authProvider: authProvider,
      defaultVersion: 'beta'
    });

    const containerRequestData = {
      displayName: req.body!.displayName,
      description: (req.body?.description) ? req.body.description : '',
      containerTypeId: process.env['CONTAINER_TYPE_ID']
    };

    const graphResponse = await graphClient.api(`storage/fileStorage/containers`).post(containerRequestData);

    res.status(200).json(graphResponse);
    return;
  } catch (error: any) {
    const apiError = classifyError(error);
    res.status(apiError.code === 'ACCESS_DENIED' ? 403 : apiError.code === 'UNAUTHORIZED' ? 401 : 500).json(apiError);
    return;
  }
};
