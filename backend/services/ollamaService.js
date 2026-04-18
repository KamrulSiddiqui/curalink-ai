const buildPrompt = ({ disease, query, patientName, publications, trials, conversationHistory }) => {
  const pubSection = publications.slice(0, 6).map((p, i) => {
    const abstract = (p.abstract || 'No abstract').slice(0, 350)
    return `[PUB ${i + 1}] Title: "${p.title}" | Authors: ${p.authors || 'Unknown'} (${p.year || 'N/A'}, ${p.source}) | Abstract: ${abstract}...`
  }).join('\n\n')

  const trialSection = trials.slice(0, 5).map((t, i) =>
    `[TRIAL ${i + 1}] Title: "${t.title}" | Status: ${t.status} | Location: ${t.location}`
  ).join('\n\n')

  return `You are Curalink, an AI medical research assistant.
PATIENT: ${patientName || 'Patient'} | DISEASE: ${disease} | QUERY: ${query}
PUBLICATIONS:\n${pubSection || 'None.'}\nTRIALS:\n${trialSection || 'None.'}
Respond in this format:
## Condition Overview
## Research Insights  
## Clinical Trial Findings
## Key Takeaway`
}

export const generateLLMResponse = async ({
  disease, query, patientName, publications, trials, conversationHistory
}) => {
  try {
    const prompt = buildPrompt({ disease, query, patientName, publications, trials, conversationHistory })

    const res = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-large', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt.slice(0, 1500) })
    })

    const text = await res.text()
    console.log('HF Raw:', text.slice(0, 200))

    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      return '**Model loading** — please try again in 30 seconds.'
    }

    let data
    try { data = JSON.parse(text) } catch (e) {
      return 'Unable to parse response. Try again.'
    }

    if (data.error?.includes('loading')) return '**Model warming up** — try again in 30 seconds.'
    if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text
    if (data.generated_text) return data.generated_text

    console.error('Unexpected:', JSON.stringify(data).slice(0, 200))
    return 'Response unavailable. Please try again.'

  } catch (error) {
    console.error('LLM error:', error.message)
    return `Error: ${error.message}`
  }
}