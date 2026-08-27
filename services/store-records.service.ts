import { createClient } from '@/lib/supabase/client';
import { getCurrentContext } from '@/lib/supabase/current-context';
import type { SupabaseClient } from '@supabase/supabase-js';

type RecordRow = { record_key: string; data: unknown };

async function context(client?: SupabaseClient) {
  const supabase = client ?? createClient();
  const current = await getCurrentContext(supabase);
  if (!current?.store) throw new Error('Não foi possível identificar a loja atual.');
  return { supabase, storeId: current.store.id };
}

export function storeCollection<T extends { id: string }>(namespace: string) {
  return {
    async list(client?: SupabaseClient): Promise<T[]> {
      const { supabase, storeId } = await context(client);
      const { data, error } = await supabase.from('neqta_records').select('record_key,data')
        .eq('store_id', storeId).eq('namespace', namespace).order('created_at');
      if (error) throw new Error(`Erro ao carregar ${namespace}: ${error.message}`);
      return ((data ?? []) as RecordRow[]).map((row) => ({ ...(row.data as T), id: row.record_key }));
    },
    async save(record: T): Promise<T> {
      const { supabase, storeId } = await context();
      const { error } = await supabase.from('neqta_records').upsert({
        store_id: storeId, namespace, record_key: record.id, data: record,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,namespace,record_key' });
      if (error) throw new Error(`Erro ao salvar ${namespace}: ${error.message}`);
      return structuredClone(record);
    },
    async replaceAll(records: T[]): Promise<T[]> {
      const current = await this.list();
      await Promise.all(records.map((record) => this.save(record)));
      await Promise.all(current.filter((row) => !records.some((record) => record.id === row.id))
        .map((row) => this.remove(row.id)));
      return structuredClone(records);
    },
    async remove(id: string): Promise<void> {
      const { supabase, storeId } = await context();
      const { error } = await supabase.from('neqta_records').delete()
        .eq('store_id', storeId).eq('namespace', namespace).eq('record_key', id);
      if (error) throw new Error(`Erro ao remover ${namespace}: ${error.message}`);
    },
  };
}

export async function loadStoreValue<T>(namespace: string, fallback: T, client?: SupabaseClient): Promise<T> {
  const rows = await storeCollection<{ id: string; value: T }>(namespace).list(client);
  return rows[0]?.value ?? structuredClone(fallback);
}

export async function saveStoreValue<T>(namespace: string, value: T): Promise<T> {
  await storeCollection<{ id: string; value: T }>(namespace).save({ id: 'current', value });
  return structuredClone(value);
}
