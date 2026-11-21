import { visitControlApi } from './visit-control-api';

export type DeletionChild = {
  external_key: string;
  surname: string;
  first_name: string;
  has_other_representatives: boolean;
  in_kindergarten: boolean;
};
export type DeletionPreview = { can_delete: boolean; children: DeletionChild[] };
const privateRequest = { skipLogging: true, skipErrorHandling: true };

export async function getDeletionPreview(signal: AbortSignal) {
  const result = await visitControlApi.get<DeletionPreview>('/user/me/deletion-preview', { ...privateRequest, signal });
  if (typeof result?.can_delete !== 'boolean' || !Array.isArray(result.children) ||
    !result.children.every(c => c && typeof c.external_key === 'string' && c.external_key &&
      typeof c.has_other_representatives === 'boolean' && typeof c.in_kindergarten === 'boolean')) {
    throw new Error('Invalid deletion preview');
  }
  return result;
}

export function deleteOwnAccount(password: string, children: string[]) {
  return visitControlApi.post<void>('/user/me/delete', { password, delete_children: children }, privateRequest);
}
