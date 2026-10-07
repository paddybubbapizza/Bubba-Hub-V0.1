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
};

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
