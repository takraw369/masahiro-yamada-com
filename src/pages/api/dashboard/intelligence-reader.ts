import { env as workerEnv } from 'cloudflare:workers';
import type { APIContext } from 'astro';
import { verifyDashboardSession } from '../../../lib/dashboardAuth';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';
import { handleIntelligenceReader } from '../../../lib/intelligenceReaderHandler';
import { type IntelligenceRow } from '../../../lib/intelligenceReader';

export const POST = async (context: APIContext) => {
  const env = getSiteStorageEnv(context.locals);
  const sessionValid = await verifyDashboardSession(context.cookies.get('ace-dash-auth')?.value, env.DASHBOARD_PASSWORD ?? '', new URL(context.request.url).origin);
  let ownerKey = '';
  const owner = async () => ownerKey ||= await getDashboardOwnerKey(env);
  return handleIntelligenceReader(context.request, {
    sessionValid,
    read: async (id) => {
      const result = await supabaseRpc<IntelligenceRow | IntelligenceRow[] | null>(env, 'masa_intelligence_reader_get_v1', { p_owner_key: await owner(), p_id: id });
      return Array.isArray(result) ? result[0] ?? null : result;
    },
    generate: async (input) => {
      const binding = (workerEnv as unknown as { FLOW_RUNNER?: { generateIntelligenceReading: (input: unknown) => Promise<any> } }).FLOW_RUNNER;
      if (!binding || typeof binding.generateIntelligenceReading !== 'function') return { ok: false, status: 'unavailable' };
      return binding.generateIntelligenceReading(input);
    },
    save: async (id, inputHash, sourceSnapshot, reading) => {
      const result = await supabaseRpc<IntelligenceRow | IntelligenceRow[]>(env, 'masa_intelligence_reader_save_v1', { p_owner_key: await owner(), p_id: id, p_input_hash: inputHash, p_expected_source: sourceSnapshot, p_reading: reading });
      const row = Array.isArray(result) ? result[0] : result;
      if (!row) throw new Error('reader_save_missing');
      return row;
    },
  });
};
