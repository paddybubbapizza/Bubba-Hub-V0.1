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
  title: string;
  tag: string;
  dateLabel: string;
  urgent: boolean;
  body: string;
};

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
  dateLabel: string;
  done: number;
  total: number;
  bad: number;
  status: CheckStatus;
  rev: string;
  k: "t" | "l";
  entries: CheckEntry[];
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
