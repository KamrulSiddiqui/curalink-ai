import fetch from 'node-fetch'

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

  const historyText = conversationHistory.slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 150)}`)
    .join('\n')

  return `<s>[INST] You are Curalink, an AI medical research assistant.

PATIENT: ${patientName || 'Patient'} | DISEASE: ${disease} | QUERY: ${query}

PUBLICATIONS:
${pubSection || 'No publications.'}

TRIALS:
${trialSection || 'No trials.'}

${historyText ? `HISTORY:\n${historyText}` : ''}

Respond in this EXACT format:

## Condition Overview
[2-3 sentences about ${disease}]

## Research Insights
[3-5 findings citing [PUB 1], [PUB 2] etc.]

## Clinical Trial Findings
[2-3 trials from the list above]

## Key Takeaway
[1-2 sentences of advice for ${patientName || 'the patient'}]
[/INST]`
}

export const generateLLMResponse = async ({
  disease, query, patientName, publications, trials, conversationHistory
}) => {
  try {
    const prompt = buildPrompt({ disease, query, patientName, publications, trials, conversationHistory })

    const response = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 800,
            temperature: 0.3,
            top_p: 0.9,
            return_full_text: false
          }
        })
      }
    )

    const text = await response.text()
    console.log('HF Raw Response:', text.slice(0, 300))

    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      return '**Model is loading** — please wait 30 seconds and try again.'
    }

    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('JSON parse error:', text.slice(0, 200))
      return 'Unable to parse model response. Please try again.'
    }

    if (data.error?.includes('loading') || data.error?.includes('currently loading')) {
      return '**Model is warming up** — please wait 30 seconds and try again.'
    }

    if (Array.isArray(data) && data[0]?.generated_text) {
      return data[0].generated_text
    }

    console.error('Unexpected response:', JSON.stringify(data).slice(0, 200))
    return 'Unable to generate response. Please try again.'

  } catch (error) {
    console.error('HuggingFace error:', error.message)
    return `Error generating AI response: ${error.message}`
  }
}