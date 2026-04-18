export const generateLLMResponse = async ({
  disease, query, patientName, publications, trials, conversationHistory
}) => {
  try {
    const pubSection = publications.slice(0, 6).map((p, i) => {
      const abstract = (p.abstract || 'No abstract').slice(0, 400)
      return `[PUB ${i + 1}] "${p.title}" by ${p.authors || 'Unknown'} (${p.year || 'N/A'}, ${p.source})\nAbstract: ${abstract}`
    }).join('\n\n')

    const trialSection = trials.slice(0, 4).map((t, i) =>
      `[TRIAL ${i + 1}] "${t.title}" | Status: ${t.status} | Phase: ${t.phase} | Location: ${t.location}`
    ).join('\n\n')

    const historyText = conversationHistory.slice(-4)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 150)}`)
      .join('\n')

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are Curalink, an expert AI medical research assistant. Always respond in the exact structured format requested. Be specific, cite sources, and provide personalized insights.'
          },
          {
            role: 'user',
            content: `Patient: ${patientName || 'Patient'} | Disease: ${disease} | Query: ${query}

RESEARCH PUBLICATIONS:
${pubSection || 'No publications available.'}

CLINICAL TRIALS:
${trialSection || 'No trials available.'}

${historyText ? `CONVERSATION HISTORY:\n${historyText}` : ''}

Respond in EXACTLY this format:

## Condition Overview
[2-3 sentences explaining ${disease} clearly for ${patientName || 'the patient'}]

## Research Insights
[3-5 specific findings from publications above. Always cite [PUB 1], [PUB 2] etc. Be specific about treatment names, statistics, breakthroughs.]

## Clinical Trial Findings
[Describe 2-3 relevant trials. Mention status, what they test, and eligibility for ${patientName || 'the patient'}.]

## Key Takeaway
[1-2 sentences of personalized, actionable advice for ${patientName || 'the patient'} based strictly on the evidence above.]`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    const data = await response.json()
    console.log('Groq status:', response.status)

    if (data.error) {
      console.error('Groq error:', data.error)
      return generateFallbackResponse(disease, query, patientName, publications, trials)
    }

    const content = data.choices?.[0]?.message?.content
    if (content) return content

    return generateFallbackResponse(disease, query, patientName, publications, trials)

  } catch (error) {
    console.error('LLM Error:', error.message)
    return generateFallbackResponse(disease, query, patientName, publications, trials)
  }
}

function generateFallbackResponse(disease, query, patientName, publications, trials) {
  const name = patientName || 'the patient'
  const pubList = publications.slice(0, 5).map((p, i) =>
    `- [PUB ${i + 1}] **${p.title}** (${p.year || 'N/A'}) by ${p.authors || 'Unknown'}`
  ).join('\n')

  const trialList = trials.slice(0, 3).map((t, i) =>
    `- [TRIAL ${i + 1}] **${t.title}** | Status: ${t.status} | 📍 ${t.location}`
  ).join('\n')

  return `## Condition Overview
${disease} is a medical condition requiring personalized treatment. Current research is actively exploring new therapeutic approaches.

## Research Insights
Key findings related to ${disease}:
${pubList || '- No publications retrieved.'}

## Clinical Trial Findings
Active trials related to ${disease}:
${trialList || '- No trials found.'}

## Key Takeaway
${name} should consult a specialist to discuss the latest evidence-based treatment options for ${disease}.`
}