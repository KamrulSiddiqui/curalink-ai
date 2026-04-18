import axios from 'axios'
import { parseStringPromise } from 'xml2js'

const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

// Step 1: Search karo - IDs laao
const searchPubMed = async (query, maxResults = 80) => {
  const url = `${PUBMED_BASE}/esearch.fcgi`
  const res = await axios.get(url, {
    params: {
      db: 'pubmed',
      term: query,
      retmax: maxResults,
      sort: 'pub date',
      retmode: 'json'
    }
  })
  return res.data.esearchresult.idlist || []
}

// Step 2: IDs se details laao
const fetchPubMedDetails = async (ids) => {
  if (!ids.length) return []
  const url = `${PUBMED_BASE}/efetch.fcgi`
  const res = await axios.get(url, {
    params: {
      db: 'pubmed',
      id: ids.join(','),
      retmode: 'xml'
    }
  })

  const parsed = await parseStringPromise(res.data, { explicitArray: false })
  const articles = parsed?.PubmedArticleSet?.PubmedArticle || []
  const list = Array.isArray(articles) ? articles : [articles]

  return list.map((item) => {
    const article = item?.MedlineCitation?.Article || {}
    const pmid = item?.MedlineCitation?.PMID?._ || item?.MedlineCitation?.PMID || ''
    const title = article?.ArticleTitle?._ || article?.ArticleTitle || 'No title'
    const abstract = article?.Abstract?.AbstractText?._ || article?.Abstract?.AbstractText || 'No abstract available'
    const journal = article?.Journal?.Title || ''
    const year = article?.Journal?.JournalIssue?.PubDate?.Year || article?.Journal?.JournalIssue?.PubDate?.MedlineDate?.split(' ')[0] || ''

    const authorList = article?.AuthorList?.Author || []
    const authors = Array.isArray(authorList)
      ? authorList.slice(0, 4).map(a => `${a.LastName || ''} ${a.ForeName || ''}`.trim()).join(', ')
      : `${authorList.LastName || ''} ${authorList.ForeName || ''}`.trim()

    return {
      id: `pubmed_${pmid}`,
      title: typeof title === 'string' ? title : 'No title',
      abstract: typeof abstract === 'string' ? abstract : 'No abstract available',
      authors,
      year,
      journal,
      source: 'PubMed',
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    }
  }).filter(a => a.title !== 'No title')
}

// Main function
export const getPubMedArticles = async (query) => {
  try {
    const ids = await searchPubMed(query, 80)
    if (!ids.length) return []
    // Batch mein fetch karo (max 20 at a time)
    const batches = []
    for (let i = 0; i < Math.min(ids.length, 60); i += 20) {
      batches.push(ids.slice(i, i + 20))
    }
    const results = await Promise.all(batches.map(batch => fetchPubMedDetails(batch)))
    return results.flat()
  } catch (error) {
    console.error('PubMed error:', error.message)
    return []
  }
}