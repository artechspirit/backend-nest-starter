import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit_action';

export interface AuditOptions {
  action: string;
  entityType?: string;
}

export const Audit = (options: AuditOptions | string) => {
  const meta = typeof options === 'string' ? { action: options } : options;
  return SetMetadata(AUDIT_METADATA_KEY, meta);
};
