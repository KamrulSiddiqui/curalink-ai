import axios from 'axios'

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const MODEL      = process.env.OLLAMA_MODEL    || 'llama3'

const buildPrompt = ({ disease, query, patientName, publications, trials, conversationHistory }) => {
  const pubSection = publications.slice(0, 6).map((p, i) => {
    const abstract = (p.abstract || 'No abstract').slice(0, 350)
    return `[PUB ${i + 1}]
Title: "${p.title}"
Authors: ${p.authors || 'Unknown'} (${p.year || 'N/A'}, ${p.source})
Abstract: ${abstract}...`
  }).join('\n\n')

  const trialSection = trials.slice(0, 5).map((t, i) =>
    `[TRIAL ${i + 1}]
Title: "${t.title}"
Status: ${t.status} | Phase: ${t.phase}
Location: ${t.location}
Contact: ${t.contact}`
  ).join('\n\n')

  const historyText = conversationHistory.slice(-6)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 200)}`)
    .join('\n')

  return `You are Curalink, a world-class AI medical research assistant. You synthesize peer-reviewed research and clinical trial data to give patients clear, accurate, personalized answers.

PATIENT INFORMATION:
- Name: ${patientName || 'Patient'}
- Disease/Condition: ${disease}
- Query: ${query}
- Location: (provided separately)

=== RESEARCH PUBLICATIONS (use these as your primary source) ===
${pubSection || 'No publications retrieved.'}

=== CLINICAL TRIALS (ongoing/completed) ===
${trialSection || 'No trials retrieved.'}

${historyText ? `=== CONVERSATION HISTORY ===\n${historyText}` : ''}

INSTRUCTIONS:
- Base your answer ONLY on the provided publications and trials above
- Reference publications as [PUB 1], [PUB 2], etc.
- Reference trials as [TRIAL 1], [TRIAL 2], etc.
- Do NOT make up information not in the sources
- Use clear, patient-friendly language
- Be specific, not generic

Respond in EXACTLY this format (use ## for each heading):

## Condition Overview
[2-3 sentences explaining ${disease} clearly for ${patientName || 'the patient'}]

## Research Insights
[3-5 specific findings from the publications above. Always cite [PUB X]. Be concrete — mention actual treatment names, statistics, or breakthroughs found in the papers.]

## Clinical Trial Findings
[Describe 2-4 relevant trials from the list above. Mention their status, what they are testing, and how ${patientName || 'a patient'} could potentially benefit or qualify. If no relevant trials, say so honestly.]

## Key Takeaway
[1-2 sentences of personalized, actionable advice for ${patientName || 'the patient'} based strictly on the evidence above. Do not give generic advice.]`
}

export const generateLLMResponse = async ({
  disease, query, patientName, publications, trials, conversationHistory
}) => {
  try {
    const prompt = buildPrompt({ disease, query, patientName, publications, trials, conversationHistory })

    // Try /api/chat first (newer Ollama)
    try {
      const res = await axios.post(`${OLLAMA_URL}/api/chat`, {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.25, num_predict: 1200, top_p: 0.9 }
      }, { timeout: 180000 })

      const content = res.data?.message?.content
      if (content) return content
    } catch (_) {
      // fall through to /api/generate
    }

    // Fallback: /api/generate (older Ollama)
    const res2 = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.25, num_predict: 1200, top_p: 0.9 }
    }, { timeout: 180000 })

    return res2.data?.response || 'Unable to generate response.'

  } catch (error) {
    console.error('Ollama error:', error.message)
    if (error.code === 'ECONNREFUSED') {
      return '**Ollama is not running.** Please start it with `ollama serve` in a terminal.'
    }
    if (error.response?.status === 404) {
      return `**Model "${MODEL}" not found.** Please run \`ollama pull ${MODEL}\` in your terminal.`
    }
    if (error.code === 'ECONNABORTED') {
      return '**Request timed out.** The model is taking too long. Try a shorter query or use tinyllama.'
    }
    return `Error generating AI response: ${error.message}`
  }
}