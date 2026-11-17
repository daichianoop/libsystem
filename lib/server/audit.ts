import { getAdminSupabase } from "./supabase";

export interface AuditLogEntry {
  id: string;
  actorProfileId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, any>;
  ip: string | null;
  createdAt: string;
}

// In-memory audit log store for offline/demo/testing resilience
const inMemoryAuditLogs: AuditLogEntry[] = [];

/**
 * Redacts any sensitive keys from metadata before logging.
 */
function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized = { ...metadata };
  const sensitiveKeys = [
    "password",
    "password_hash",
    "passwordHash",
    "hashCode",
    "hash_code",
    "code",
    "secret",
    "card_secret",
    "token",
  ];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

/**
 * Records an immutable audit log entry.
 */
export async function logAuditEvent(params: {
  actorProfileId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
  ip?: string | null;
}): Promise<AuditLogEntry> {
  const cleanMeta = sanitizeMetadata(params.metadata || {});

  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actorProfileId: params.actorProfileId || null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId || null,
    metadata: cleanMeta,
    ip: params.ip || null,
    createdAt: new Date().toISOString(),
  };

  inMemoryAuditLogs.unshift(entry);

  // Attempt Supabase insert if available
  try {
    const supabase = getAdminSupabase();
    await supabase.from("audit_logs").insert({
      actor_profile_id: entry.actorProfileId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: entry.metadata,
      ip: entry.ip,
      created_at: entry.createdAt,
    });
  } catch {
    // If Supabase is unavailable or offline, inMemory log is preserved
  }

  return entry;
}

/**
 * Queries audit logs with optional filtering.
 */
export async function getAuditLogs(params?: {
  entityType?: string;
  entityId?: string;
  action?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  let list = [...inMemoryAuditLogs];

  if (params?.entityType) {
    list = list.filter((l) => l.entityType === params.entityType);
  }
  if (params?.entityId) {
    list = list.filter((l) => l.entityId === params.entityId);
  }
  if (params?.action) {
    list = list.filter((l) => l.action === params.action);
  }

  return list.slice(0, params?.limit || 50);
}
