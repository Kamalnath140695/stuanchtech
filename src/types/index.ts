export interface DMSUser {
  id: number;
  name: string;
  email: string;
  role: string;
  auth_provider: string;
  created_at: string;
}

export interface PermissionResponse {
  id: number;
  user_id: number;
  permission_type: string;
  permission_action: string;
  resource_id: string | null;
  created_at: string;
}

export interface PermissionCreate {
  permission_type: string;
  permission_action: string;
  resource_id: string | null;
}