// Tipos de las filas de la base (subset usado por la app)

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  tax_id_type: string;
  currency: string;
}

export interface ProductRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  active: boolean;
}

export interface PartyRow {
  id: string;
  tenant_id: string;
  kind: "human" | "legal";
  tax_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  data: Record<string, unknown>;
}

export type CaseStatus =
  | "invited"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "blocked";

export interface CaseRow {
  id: string;
  tenant_id: string;
  party_id: string;
  product_id: string;
  status: CaseStatus;
  current_layer: number;
  risk_level: "low" | "medium" | "high" | null;
  transactional_profile: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export interface CaseLayerRow {
  id: string;
  case_id: string;
  layer: number;
  status: "pending" | "in_progress" | "completed" | "approved";
  data: Record<string, unknown>;
  completed_at: string | null;
}

export interface CheckRow {
  id: string;
  case_id: string;
  check_code: string;
  status: "pending" | "passed" | "flagged" | "blocked";
  result_notes: string | null;
  checked_by: string | null;
  checked_at: string | null;
}

export interface InviteRow {
  id: string;
  tenant_id: string;
  case_id: string;
  token: string;
  email: string;
  status: "created" | "sent" | "opened" | "verified" | "expired" | "revoked";
  attempts: number;
  max_attempts: number;
  expires_at: string | null;
}

export interface EventRow {
  id: string;
  case_id: string;
  event: string;
  detail: Record<string, unknown>;
  actor: string;
  created_at: string;
}

export interface PersonEntry {
  nombre: string;
  tax_id: string;
  email?: string;
  pct?: number;
}
