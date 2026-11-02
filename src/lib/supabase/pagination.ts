/**
 * Utilitário otimizado para paginação paralela rápida no Supabase/PostgREST.
 * Evita o custo de `SELECT COUNT(*)` na 1ª página se o total de registos for inferior a `pageSize`.
 */
export async function fetchAllRowsFast<T>(
  fetchPage: (
    from: number,
    to: number,
    countMode?: 'exact'
  ) => PromiseLike<{ data: T[] | null; count?: number | null; error: unknown }>,
  pageSize = 2000
): Promise<T[]> {
  const firstPage = await fetchPage(0, pageSize - 1);
  if (firstPage.error || !firstPage.data) {
    if (firstPage.error) {
      console.error('Erro ao buscar dados paginados:', firstPage.error);
    }
    return [];
  }

  const allRows: T[] = [...firstPage.data];

  // Se a 1ª página já trouxe todos os dados (< pageSize), termina de imediato sem COUNT(*)
  if (firstPage.data.length < pageSize) {
    return allRows;
  }

  // Apenas se atingir o limite da 1ª página obtemos a contagem exata para paralelizar o restante
  const countRes = await fetchPage(0, 0, 'exact');
  const total = countRes.count ?? allRows.length;

  if (total <= pageSize) {
    return allRows;
  }

  const numRemainingPages = Math.ceil((total - pageSize) / pageSize);
  const remainingPromises = Array.from({ length: numRemainingPages }, (_, i) => {
    const pageIndex = i + 1;
    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;
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

