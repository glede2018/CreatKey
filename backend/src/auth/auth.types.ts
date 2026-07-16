import type { Request } from "express";
export interface AuthUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  roles: string[];
  profileInitialized: boolean;
  phone: string;
  keys: number;
  sessionVersion: number;
}
export interface AuthRequest extends Request {
  user: AuthUser;
  sessionId: string;
}
