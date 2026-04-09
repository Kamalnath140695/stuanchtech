import express from 'express';
import * as dotenv from 'dotenv';
import { listContainers } from './listContainers';
import { createContainer } from './createContainer';
import { listContainerPermissions, addContainerPermission, removeContainerPermission } from './containerPermissions';
import { listUsers } from './users';
import { listApps, createApp, deleteApp, assignContainerPermissionToApp } from './appManagement';

dotenv.config();

const app = express();
app.use(express.json());

// CORS support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

// container routes
app.get('/api/listContainers', async (req, res, next) => {
  try {
    await listContainers(req, res);
  } catch (error: any) {
    res.status(500).json({ message: `Error in API server: ${error.message}` });
  }
});

app.post('/api/createContainer', async (req, res, next) => {
  try {
    await createContainer(req, res);
  } catch (error: any) {
    res.status(500).json({ message: `Error in API server: ${error.message}` });
  }
});

// app management routes
app.get('/api/apps', async (req, res) => {
  try { await listApps(req, res); }
  catch (error: any) { res.status(500).json({ message: error.message }); }
});

app.post('/api/apps', async (req, res) => {
  try { await createApp(req, res); }
  catch (error: any) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/apps', async (req, res) => {
  try { await deleteApp(req, res); }
  catch (error: any) { res.status(500).json({ message: error.message }); }
});

app.post('/api/apps/container-permission', async (req, res) => {
  try { await assignContainerPermissionToApp(req, res); }
  catch (error: any) { res.status(500).json({ message: error.message }); }
});

// user routes
app.get('/api/users', async (req, res) => {
  try { await listUsers(req, res); }
  catch (error: any) { res.status(500).json({ message: error.message }); }
});

// container permission routes - containerId passed as query param to avoid path encoding issues
app.get('/api/containers/permissions', async (req, res) => {
  try { await listContainerPermissions(req, res); }
  catch (error: any) { res.status(500).json({ message: error.message }); }
});

app.post('/api/containers/permissions', async (req, res) => {
  try { await addContainerPermission(req, res); }
  catch (error: any) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/containers/permissions', async (req, res) => {
  try { await removeContainerPermission(req, res); }
  catch (error: any) { res.status(500).json({ message: error.message }); }
});

const port = process.env.port || process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`\nAPI server started, listening on port ${port}`);
});
