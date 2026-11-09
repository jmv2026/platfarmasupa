/**
 * Utilitário otimizado para paginação paralela rápida no Supabase/PostgREST.
 * Evita o custo de `SELECT COUNT(*)` na 1ª página se o total de registos for inferior a `pageSize`.
 */
const POSTGREST_MAX_ROWS = 1000;

export async function fetchAllRowsFast<T>(
  fetchPage: (
    from: number,
    to: number,
    countMode?: 'exact'
  ) => PromiseLike<{ data: T[] | null; count?: number | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  // O PostgREST/Supabase limita por defeito cada resposta a 1000 linhas (db-max-rows = 1000).
  // Garantir que o tamanho de página usado no cálculo nunca excede 1000, evitando truncagem prematura.
  const effectivePageSize = Math.min(pageSize, POSTGREST_MAX_ROWS);

  const firstPage = await fetchPage(0, effectivePageSize - 1);
  if (firstPage.error || !firstPage.data) {
    if (firstPage.error) {
      console.error('Erro ao buscar dados paginados:', firstPage.error);
    }
    return [];
  }

  const allRows: T[] = [...firstPage.data];

  // Se a 1ª página já trouxe todos os dados (< effectivePageSize), termina de imediato sem COUNT(*)
  if (firstPage.data.length < effectivePageSize) {
    return allRows;
  }

  // Apenas se atingir o limite da 1ª página obtemos a contagem exata para paralelizar o restante
  const countRes = await fetchPage(0, 0, 'exact');
  const total = countRes.count ?? allRows.length;

  if (total <= effectivePageSize) {
    return allRows;
  }

  const numRemainingPages = Math.ceil((total - effectivePageSize) / effectivePageSize);
  const remainingPromises = Array.from({ length: numRemainingPages }, (_, i) => {
    const pageIndex = i + 1;
    const from = pageIndex * effectivePageSize;
    const to = from + effectivePageSize - 1;
    return fetchPage(from, to);
  });

  const remainingResults = await Promise.all(remainingPromises);
  for (const res of remainingResults) {
    if (res.data) {
      allRows.push(...res.data);
    }
  }

  return allRows;
}

