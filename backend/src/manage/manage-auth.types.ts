import type { Request } from "express";

export interface ManageAdmin {
  id: string;
  username: string;
  displayName: string;
}

export interface ManageAuthRequest extends Request {
  manageAdmin: ManageAdmin;
  manageSessionId: string;
}
