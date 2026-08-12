import type { Timestamp } from "firebase/firestore";

export type AccessRole = "admin" | "leader" | "common";
export type PersonType = "member" | "visitor";
export type EventScope = "global" | "groups";

export interface UserProfile {
  name: string;
  nameSearch: string;
  username: string;
  birthMonthDay: string; // MM-DD; chave indexável para a automação
  phoneE164: string;
  mustChangePassword: boolean;
  photoUrl: string | null;
  photoPublicId: string | null;
  role: AccessRole;
  type: PersonType;
  groupIds: string[]; // projeção mantida junto com os vínculos para Rules e consultas
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPrivate {
  birthDate: string | null; // YYYY-MM-DD; somente administradores
  conversionDate: string | null;
  conversionReason: string | null;
  legacyPhotoPath?: string | null;
  updatedAt: Timestamp;
}

export interface SyncDocument {
  version: string;
  schemaVersion: number;
  updatedAt: Timestamp;
}

export type ChangeOperation = "create" | "update" | "delete";
export type ChangeEntity = "user" | "group" | "membership" | "event";

export interface SyncChange {
  entity: ChangeEntity;
  entityId: string;
  operation: ChangeOperation;
  scope: "global" | "group" | "user";
  groupId: string | null;
  userId: string | null;
  version: string;
  changedAt: Timestamp;
}

export interface CommunityGroup {
  name: string;
  description: string;
  leaderIds: string[];
  participantIds: string[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupMembership {
  groupId: string;
  userId: string;
  isLeader: boolean;
  active: boolean;
  joinedAt: Timestamp;
}

export interface ChurchEvent {
  title: string;
  description: string;
  startsAt: Timestamp;
  eventDate: string; // YYYY-MM-DD em America/Sao_Paulo
  timezone: "America/Sao_Paulo";
  scope: EventScope;
  groupIds: string[];
  pdfUrl: string | null;
  pdfPublicId: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DeviceToken {
  token: string;
  platform: "web";
  enabled: boolean;
  updatedAt: Timestamp;
}
