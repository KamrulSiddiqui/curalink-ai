import { HfInference } from '@huggingface/inference'

const hf = new HfInference(process.env.HF_TOKEN)
const MODEL = 'mistralai/Mistral-7B-Instruct-v0.3'

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

=== RESEARCH PUBLICATIONS ===
${pubSection || 'No publications retrieved.'}

=== CLINICAL TRIALS ===
${trialSection || 'No trials retrieved.'}

${historyText ? `=== CONVERSATION HISTORY ===\n${historyText}` : ''}

INSTRUCTIONS:
- Base your answer ONLY on the provided publications and trials above
- Reference publications as [PUB 1], [PUB 2], etc.
- Reference trials as [TRIAL 1], [TRIAL 2], etc.
- Do NOT make up information not in the sources
- Use clear, patient-friendly language

Respond in EXACTLY this format:

## Condition Overview
[2-3 sentences explaining ${disease} clearly for ${patientName || 'the patient'}]

## Research Insights
[3-5 specific findings from the publications above. Always cite [PUB X].]

## Clinical Trial Findings
[Describe 2-4 relevant trials. Mention status, what they test, eligibility.]

## Key Takeaway
[1-2 sentences of personalized advice based strictly on evidence above.]`
}

export const generateLLMResponse = async ({
  disease, query, patientName, publications, trials, conversationHistory
}) => {
  try {
    const prompt = buildPrompt({ disease, query, patientName, publications, trials, conversationHistory })

    const response = await hf.chatCompletion({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are Curalink, an expert AI medical research assistant. Always respond in the exact format requested. Be specific and cite sources.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1200,
      temperature: 0.25,
      top_p: 0.9
    })

    const content = response.choices?.[0]?.message?.content
    if (content) return content

    return 'Unable to generate response. Please try again.'

  } catch (error) {
    console.error('HuggingFace error:', error.message, error.status, JSON.stringify(error))

    // Rate limit
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      return '**Rate limit reached.** Please wait a moment and try again.'
    }

    // Model loading
    if (error.message?.includes('loading') || error.message?.includes('503')) {
      return '**Model is loading** (first request takes ~20 seconds). Please try again shortly.'
    }

    // Token invalid
    if (error.message?.includes('401') || error.message?.includes('Authorization')) {
      return '**HF_TOKEN invalid.** Please check your Hugging Face API token in environment variables.'
    }

    return `Error generating AI response: ${error.message}`
  }
}