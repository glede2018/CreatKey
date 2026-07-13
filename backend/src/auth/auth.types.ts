import type { Request } from "express";
export interface AuthUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  roles: string[];
  points: number;
  sessionVersion: number;
}
export interface AuthRequest extends Request {
  user: AuthUser;
  sessionId: string;
}
