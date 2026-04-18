import axios from 'axios'

const OPENALEX_BASE = 'https://api.openalex.org/works'

export const getOpenAlexArticles = async (query) => {
  try {
    const allResults = []

    // Page 1 aur 2 dono fetch karo - broad pool banane ke liye
    const pages = [1, 2, 3]
    const fetches = pages.map(page =>
      axios.get(OPENALEX_BASE, {
        params: {
          search: query,
          'per-page': 50,
          page,
          sort: 'relevance_score:desc',
          filter: 'from_publication_date:2015-01-01'
        },
        headers: { 'User-Agent': 'Curalink/1.0 (hackathon project)' }
      }).catch(() => null)
    )

    const responses = await Promise.all(fetches)

    for (const res of responses) {
      if (!res?.data?.results) continue
      const articles = res.data.results.map((work) => {
        const authors = (work.authorships || [])
          .slice(0, 4)
          .map(a => a.author?.display_name || '')
          .filter(Boolean)
          .join(', ')

        const year = work.publication_year || ''
        const abstract = work.abstract || work.abstract_inverted_index
          ? rebuildAbstract(work.abstract_inverted_index)
          : 'No abstract available'

        return {
          id: `openalex_${work.id?.split('/').pop()}`,
          title: work.title || 'No title',
          abstract,
          authors,
          year,
          journal: work.primary_location?.source?.display_name || '',
          citationCount: work.cited_by_count || 0,
          source: 'OpenAlex',
          url: work.primary_location?.landing_page_url || work.doi ? `https://doi.org/${work.doi}` : '#'
        }
      })
      allResults.push(...articles)
    }

    return allResults.filter(a => a.title !== 'No title')
  } catch (error) {
    console.error('OpenAlex error:', error.message)
    return []
  }
}

// OpenAlex abstract inverted index ko normal text mein convert karo
const rebuildAbstract = (invertedIndex) => {
  if (!invertedIndex || typeof invertedIndex !== 'object') return 'No abstract available'
  try {
    const words = []
    for (const [word, positions] of Object.entries(invertedIndex)) {
      for (const pos of positions) {
        words[pos] = word
      }
    }
    return words.filter(Boolean).join(' ')
  } catch {
    return 'No abstract available'
  }
}