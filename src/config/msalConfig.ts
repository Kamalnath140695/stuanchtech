export const msalConfig = {
  auth: {
    clientId: '44e5a5e8-847f-465d-a68a-3a516aefbe97',
    authority: 'https://login.microsoftonline.com/cd42dbac-81bd-4fbd-b910-49ca5f79737f',
    redirectUri: 'http://localhost:3000/auth-callback',
    postLogoutRedirectUri: 'http://localhost:3000/login',
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    allowNativeBroker: false,
    loggerOptions: {
      loggerCallback: (level: any, message: string, containsPii: boolean) => {
        if (containsPii) return;
        console.log('[MSAL]', message);
      },
      logLevel: 3,
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};