const currentYear = new Date().getFullYear()

const getKeywords = (query) => {
  const stopWords = new Set([
    'the','a','an','and','or','for','in','of','on','with',
    'latest','recent','study','studies','what','about','tell',
    'me','is','are','how','why','when','where','top','best'
  ])
  return query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
}

const keywordScore = (text, keywords) => {
  if (!text || !keywords.length) return 0
  const lower = text.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    if (lower.includes(kw)) score += 1
    else if (lower.split(/\s+/).some(w => w.startsWith(kw) && kw.length >= 4)) score += 0.4
  }
  return Math.min(score / keywords.length, 1)
}

const recencyScore = (year) => {
  if (!year) return 0.1
  const age = currentYear - parseInt(year)
  if (age <= 0) return 1.0
  if (age <= 1) return 0.95
  if (age <= 2) return 0.85
  if (age <= 3) return 0.75
  if (age <= 5) return 0.60
  if (age <= 8) return 0.40
  if (age <= 12) return 0.25
  return 0.1
}

const citationScore = (count) => {
  if (!count || count === 0) return 0.1
  if (count >= 1000) return 1.0
  if (count >= 500)  return 0.9
  if (count >= 200)  return 0.8
  if (count >= 100)  return 0.7
  if (count >= 50)   return 0.55
  if (count >= 20)   return 0.4
  if (count >= 5)    return 0.25
  return 0.1
}

export const rankPublications = (publications, query, topK = 8) => {
  const keywords = getKeywords(query)
  if (!keywords.length) return publications.slice(0, topK)

  const scored = publications.map(pub => {
    const titleKw    = keywordScore(pub.title    || '', keywords) * 0.45
    const abstractKw = keywordScore(pub.abstract || '', keywords) * 0.15
    const recency    = recencyScore(pub.year)                    * 0.25
    const citation   = citationScore(pub.citationCount)          * 0.15
    return { ...pub, _score: titleKw + abstractKw + recency + citation }
  })

  // Filter out totally irrelevant papers
  const filtered = scored.filter(pub => {
    const titleMatch = keywordScore(pub.title    || '', keywords)
    const absMatch   = keywordScore(pub.abstract || '', keywords)
    return (titleMatch + absMatch) > 0.08
  })

  const pool = filtered.length >= topK ? filtered : scored

  // Deduplicate by title
  const seen = new Set()
  const deduped = pool.filter(pub => {
    const key = (pub.title || '').toLowerCase().trim().slice(0, 80)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduped
    .sort((a, b) => b._score - a._score)
    .slice(0, topK)
}

export const rankTrials = (trials, query, topK = 6) => {
  const keywords = getKeywords(query)

  const scored = trials.map(trial => {
    const titleKw = keywordScore(trial.title       || '', keywords) * 0.45
    const eligKw  = keywordScore(trial.eligibility || '', keywords) * 0.15
    const statusBonus = trial.status === 'RECRUITING'            ? 0.30
                      : trial.status === 'ACTIVE_NOT_RECRUITING' ? 0.20
                      : trial.status === 'COMPLETED'             ? 0.10
                      : 0.05
    return { ...trial, _score: titleKw + eligKw + statusBonus }
  })

  const seen = new Set()
  const deduped = scored.filter(trial => {
    const key = (trial.title || '').toLowerCase().trim().slice(0, 80)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduped
    .sort((a, b) => b._score - a._score)
    .slice(0, topK)
}

export const expandQuery = (disease, userQuery) => {
  if (!userQuery) return disease
  const dLower = disease.toLowerCase()
  const qLower = userQuery.toLowerCase()
  if (qLower.includes(dLower)) return userQuery
  return `${userQuery} ${disease}`
}