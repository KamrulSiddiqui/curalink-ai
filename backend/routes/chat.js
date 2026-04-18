import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import Session from '../models/Session.js'
import { getPubMedArticles } from '../services/pubmedService.js'
import { getOpenAlexArticles } from '../services/openalexService.js'
import { getClinicalTrials } from '../services/clinicalTrialsService.js'
import { rankPublications, rankTrials, expandQuery } from '../services/rankingService.js'
import { generateLLMResponse } from '../services/ollamaService.js'

const router = express.Router()

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, sessionId, patientName, disease, location } = req.body

    if (!message) return res.status(400).json({ error: 'Message is required.' })
    if (!disease) return res.status(400).json({ error: 'Disease/condition is required.' })

    // Session management
    let session = null
    let sid = sessionId

    if (sid) {
      session = await Session.findOne({ sessionId: sid }).catch(() => null)
    }

    if (!session) {
      sid = uuidv4()
      session = new Session({
        sessionId: sid,
        patientName: patientName || '',
        disease: disease || '',
        location: location || ''
      })
    }

    // Update session context
    if (patientName) session.patientName = patientName
    if (disease)     session.disease     = disease
    if (location)    session.location    = location

    // Save user message
    session.messages.push({ role: 'user', content: message })

    const activeDiseae   = session.disease || disease
    const expandedQuery  = expandQuery(activeDiseae, message)

    console.log(`\n🔍 Query: "${expandedQuery}"`)
    console.log(`👤 Patient: ${session.patientName || 'Unknown'} | Disease: ${activeDiseae}`)

    // Parallel API calls
    const [pubmedResults, openalexResults, trialsResults] = await Promise.all([
      getPubMedArticles(expandedQuery),
      getOpenAlexArticles(expandedQuery),
      getClinicalTrials(activeDiseae, message, session.location)
    ])

    console.log(`📚 Retrieved → PubMed: ${pubmedResults.length} | OpenAlex: ${openalexResults.length} | Trials: ${trialsResults.length}`)

    // Merge and rank
    const allPublications    = [...pubmedResults, ...openalexResults]
    const rankedPublications = rankPublications(allPublications, expandedQuery, 8)
    const rankedTrials       = rankTrials(trialsResults, expandedQuery, 6)

    console.log(`✅ After ranking → Publications: ${rankedPublications.length} | Trials: ${rankedTrials.length}`)

    // LLM response
    const llmResponse = await generateLLMResponse({
      disease: activeDiseae,
      query: message,
      patientName: session.patientName,
      publications: rankedPublications,
      trials: rankedTrials,
      conversationHistory: session.messages.slice(-10)
    })

    // Save assistant response
    session.messages.push({ role: 'assistant', content: llmResponse })
    session.updatedAt = new Date()
    await session.save().catch(err => console.error('Session save error:', err.message))

    return res.json({
      sessionId: sid,
      response: llmResponse,
      publications: rankedPublications,
      trials: rankedTrials,
      meta: {
        totalFetched:   allPublications.length + trialsResults.length,
        pubmedCount:    pubmedResults.length,
        openalexCount:  openalexResults.length,
        trialsCount:    trialsResults.length,
        rankedPubs:     rankedPublications.length,
        rankedTrials:   rankedTrials.length,
        query:          expandedQuery
      }
    })

  } catch (error) {
    console.error('Chat route error:', error)
    return res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
})

// GET /api/chat/session/:id
router.get('/session/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id })
    if (!session) return res.status(404).json({ error: 'Session not found' })
    return res.json(session)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/chat/sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await Session.find(
      {},
      'sessionId patientName disease createdAt updatedAt'
    ).sort({ updatedAt: -1 }).limit(20)
    return res.json(sessions)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

export default router