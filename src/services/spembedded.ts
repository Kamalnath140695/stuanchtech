import { Providers, ProviderState } from '@microsoft/mgt-element';
import * as Constants from './../common/constants';
import { IContainer } from './../common/IContainer';

export default class SpEmbedded {

  async getApiAccessToken(): Promise<string> {
    const provider = Providers.globalProvider;
    if (!provider || provider.state !== ProviderState.SignedIn) throw new Error('User not signed in');
    return await provider.getAccessToken({ scopes: ['https://graph.microsoft.com/.default'] });
  }

  // Lists all containers - backend handles its own Graph API auth
  async listContainers(): Promise<IContainer[]> {
    const api_endpoint = `${Constants.API_SERVER_URL}/api/listContainers`;

    try {
      const response = await fetch(api_endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('listContainers response:', data);

        // Handle both { value: [...] } and direct array responses
        if (Array.isArray(data)) return data as IContainer[];
        if (data.value && Array.isArray(data.value)) return data.value as IContainer[];
        return [];
      } else {
        const errText = await response.text();
        console.error(`listContainers failed [${response.status}]:`, errText);
        return [];
      }
    } catch (err) {
      console.error('listContainers network error:', err);
      return [];
    }
  }

  // Creates a new container
  async createContainer(containerName: string, containerDescription: string = ''): Promise<IContainer | undefined> {
    const api_endpoint = `${Constants.API_SERVER_URL}/api/createContainer`;

    if (Providers.globalProvider?.state !== ProviderState.SignedIn) {
      console.warn('createContainer: user not signed in');
      return undefined;
    }

    try {
      const response = await fetch(api_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: containerName,
          description: containerDescription
        })
      });

      if (response.ok) {
        return await response.json() as IContainer;
      } else {
        const errText = await response.text();
        console.error(`createContainer failed [${response.status}]:`, errText);
        return undefined;
      }
    } catch (err) {
      console.error('createContainer network error:', err);
      return undefined;
    }
  }

}
