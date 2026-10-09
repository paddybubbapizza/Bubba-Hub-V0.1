export type Role = "Company account" | "Franchisee" | "Manager" | "Staff";

export type User = {
  id: string;
  username: string;
  name: string;
  first: string;
  role: Role;
  stores: string[];
  co: boolean;
  active: boolean;
  pref: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
};

export type Store = { name: string; owner: string };

export type Announcement = {
  id: string;
  title: string;
  body: string;
  urgency: string;
  category: string;
  tags: string[];
  audienceRoles: string[];
  stores: string[];
  compulsory: boolean;
  attachments: FileRef[];
  author: string;
  authorRole: string;
  dateLabel: string;
  labels: string[];
  read: boolean;
  canEdit: boolean;
  readCount: number;
};

export type AnnouncementOptions = { urgencies: string[]; categories: string[]; roles: string[] };

export type FileRef = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  url: string;
  isImage: boolean;
};

export type TrainingTask = { key: string; name: string; desc: string };
export type TrainingCategory = { key: string; name: string; icon: string; tasks: TrainingTask[] };
export type TrainingPerson = { id: string; name: string; role: string; stores: string[]; done: number; total: number };
export type TrainingProgress = {
  user: { id: string; name: string; role: string };
  canEdit: boolean;
  done: Record<string, { by: string; dateLabel: string }>;
};

export type DueItem = { type: string; shift: string; freq: "daily" | "monthly"; label: string; done: boolean };
export type StoreDue = { store: string; pending: number; items: DueItem[] };

export type CheckStatus = "awaiting" | "approved" | "returned";

export type TempEntry = { name: string; hint: string; value: number | null; ok: boolean };
export type ItemEntry = { name: string; done: boolean };
export type CheckEntry = TempEntry | ItemEntry;

export type Check = {
  id: string;
  store: string;
  type: string;
  shift: string;
  by: string;
  byId: string | null;
  dateLabel: string;
  done: number;
  total: number;
  bad: number;
  status: CheckStatus;
  rev: string;
  k: "t" | "l";
  entries: CheckEntry[];
  modifiedBy: string;
};

export type IncidentStatus = "pending" | "completed";

export type Person = { id: string; name: string; role?: string };

export type Incident = {
  id: string;
  store: string;
  urgency: string;
  type: string;
  involved: Person[];
  occurredAt: string;
  location: string;
  description: string;
  actions: string;
  followUp: boolean;
  attachments: FileRef[];
  by: string;
  byId: string | null;
  dateLabel: string;
  status: IncidentStatus;
  rev: string;
  revNote: string;
  reviewedLabel: string;
};

export type IncidentOptions = { urgencies: string[]; types: string[] };

export type TempRow = { name: string; limitType: "max" | "min"; limit: number };
export type ItemRow = { name: string };
export type Row = TempRow | ItemRow;

export type Template = {
  name: string;
  k: "t" | "l";
  shift: boolean;
  rows: Row[];
  overrides: Record<string, Row[]>;
};
