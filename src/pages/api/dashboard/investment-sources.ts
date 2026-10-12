import type { APIContext } from 'astro';
import { investmentResearchPacks, investmentResearchSources } from '../../../data/investmentResearchSources';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'private, max-age=300',
  },
});

export const GET = async (_context: APIContext) => {
  return json({
    ok: true,
    version: 1,
    counts: {
      total: investmentResearchSources.length,
      original50: investmentResearchSources.filter(source => source.original50).length,
      primary: investmentResearchSources.filter(source => source.kind === 'primary').length,
      adapterCandidates: investmentResearchSources.filter(source => source.integration === 'adapter').length,
    },
    packs: investmentResearchPacks,
    sources: investmentResearchSources,
  });
};
