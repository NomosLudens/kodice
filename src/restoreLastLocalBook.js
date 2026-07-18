export async function restoreLastLocalBook({ progressRows, books, getBookFile, openBook }) {
  const localBookIds = new Set((books || [])
    .map(book => book?.id)
    .filter(id => typeof id === 'string' && id.trim() !== ''));

  const candidates = (progressRows || [])
    .filter(progress => {
      const id = progress?.book_id;
      const timestamp = Number(progress?.updated_at);
      return typeof id === 'string'
        && id.trim() !== ''
        && !id.startsWith('station:')
        && Number.isFinite(timestamp)
        && timestamp > 0
        && localBookIds.has(id);
    })
    .sort((a, b) => Number(b.updated_at) - Number(a.updated_at));

  for (const progress of candidates) {
    const id = progress.book_id;
    try {
      const file = await getBookFile(id);
      if (!file?.data) continue;
      if (await openBook(id)) return true;
    } catch (error) {
      console.warn('[Kódice] Não foi possível restaurar o livro local.', error);
    }
  }

  return false;
}
