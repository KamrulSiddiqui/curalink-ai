export const generateLLMResponse = async ({
  disease, query, patientName, publications, trials, conversationHistory
}) => {
  try {
    const pubSection = publications.slice(0, 6).map((p, i) => {
      const abstract = (p.abstract || 'No abstract').slice(0, 300)
      return `[PUB ${i + 1}] "${p.title}" by ${p.authors || 'Unknown'} (${p.year || 'N/A'}) - ${abstract}`
    }).join('\n')

    const trialSection = trials.slice(0, 4).map((t, i) =>
      `[TRIAL ${i + 1}] "${t.title}" | Status: ${t.status} | Location: ${t.location}`
    ).join('\n')

    const prompt = `You are Curalink, a medical research assistant. Answer based ONLY on the provided research.

Patient: ${patientName || 'Patient'} | Disease: ${disease} | Question: ${query}

RESEARCH PUBLICATIONS:
${pubSection || 'No publications available.'}

CLINICAL TRIALS:
${trialSection || 'No trials available.'}

Respond in exactly this format:

## Condition Overview
Write 2-3 sentences explaining ${disease} clearly.

## Research Insights
List 3-5 specific findings from publications above. Cite as [PUB 1], [PUB 2] etc.

## Clinical Trial Findings
Describe 2-3 relevant trials from the list. Mention status and what they test.

## Key Takeaway
Write 1-2 sentences of advice for ${patientName || 'the patient'} based on the evidence.`

    console.log('Calling HuggingFace API...')

    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json',
          'x-use-cache': 'false'
        },
        body: JSON.stringify({
          inputs: `<s>[INST] ${prompt} [/INST]`,
          parameters: {
            max_new_tokens: 600,
            temperature: 0.3,
            return_full_text: false,
            do_sample: true
          }
        })
      }
    )

    const text = await response.text()
    console.log('HF Status:', response.status)
    console.log('HF Raw:', text.slice(0, 300))

    // HTML error check
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      console.error('Got HTML response - wrong endpoint or model unavailable')
      return generateFallbackResponse(disease, query, patientName, publications, trials)
    }

    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('JSON parse failed:', text.slice(0, 100))
      return generateFallbackResponse(disease, query, patientName, publications, trials)
    }

    // Model loading
    if (data.error) {
      console.error('HF API Error:', data.error)
      if (data.error.includes('loading') || data.estimated_time) {
        return generateFallbackResponse(disease, query, patientName, publications, trials)
      }
      return generateFallbackResponse(disease, query, patientName, publications, trials)
    }

    // Success
    if (Array.isArray(data) && data[0]?.generated_text) {
      return data[0].generated_text
    }

    return generateFallbackResponse(disease, query, patientName, publications, trials)

  } catch (error) {
    console.error('LLM Error:', error.message)
    return generateFallbackResponse(disease, query, patientName, publications, trials)
  }
}

// Fallback — jab bhi model unavailable ho, yeh structured response dega
function generateFallbackResponse(disease, query, patientName, publications, trials) {
  const name = patientName || 'the patient'
  const pubList = publications.slice(0, 5).map((p, i) =>
    `- [PUB ${i + 1}] **${p.title}** (${p.year || 'N/A'}) by ${p.authors || 'Unknown'}`
  ).join('\n')

  const trialList = trials.slice(0, 3).map((t, i) =>
    `- [TRIAL ${i + 1}] **${t.title}** | Status: ${t.status} | 📍 ${t.location}`
  ).join('\n')

  return `## Condition Overview
${disease} is a serious medical condition that requires personalized treatment based on individual patient factors. Current research is actively exploring new therapeutic approaches to improve patient outcomes.

## Research Insights
Based on the retrieved publications, here are key findings related to ${disease} and "${query}":

${pubList || '- No publications retrieved for this query.'}

These studies highlight the importance of evidence-based treatment approaches and ongoing research in this area.

## Clinical Trial Findings
The following clinical trials are currently recruiting patients related to ${disease}:

${trialList || '- No clinical trials found for this query.'}

Patients interested in participating should review eligibility criteria and contact the trial coordinators.

## Key Takeaway
Based on current research, ${name} should consult with a specialist to discuss the latest treatment options for ${disease}. The publications and clinical trials above provide a strong foundation for evidence-based decision making.`
}