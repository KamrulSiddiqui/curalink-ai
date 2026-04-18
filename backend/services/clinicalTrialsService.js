import axios from 'axios'

const CT_BASE = 'https://clinicaltrials.gov/api/v2/studies'

export const getClinicalTrials = async (disease, query = '', location = '') => {
  try {
    // Fetch recruiting, active, and completed in parallel
    const [recruiting, active, completed] = await Promise.all([
      axios.get(CT_BASE, {
        params: {
          'query.cond': disease,
          'filter.overallStatus': 'RECRUITING',
          pageSize: 50,
          format: 'json'
        },
        timeout: 15000
      }).catch(() => null),

      axios.get(CT_BASE, {
        params: {
          'query.cond': disease,
          'filter.overallStatus': 'ACTIVE_NOT_RECRUITING',
          pageSize: 30,
          format: 'json'
        },
        timeout: 15000
      }).catch(() => null),

      axios.get(CT_BASE, {
        params: {
          'query.cond': disease,
          'filter.overallStatus': 'COMPLETED',
          pageSize: 30,
          format: 'json'
        },
        timeout: 15000
      }).catch(() => null)
    ])

    const allStudies = [
      ...(recruiting?.data?.studies || []),
      ...(active?.data?.studies    || []),
      ...(completed?.data?.studies || [])
    ]

    if (!allStudies.length) {
      console.log(`No trials found for disease: ${disease}`)
      return []
    }

    return allStudies.map((study) => {
      const proto = study?.protocolSection || {}
      const id    = proto?.identificationModule?.nctId || ''
      const title = proto?.identificationModule?.briefTitle || 'Untitled Study'

      const status      = proto?.statusModule?.overallStatus || 'UNKNOWN'
      const phases      = proto?.designModule?.phases || []
      const phase       = phases.join(', ') || 'N/A'
      const conditions  = (proto?.conditionsModule?.conditions || [disease]).join(', ')
      const eligibility = proto?.eligibilityModule?.eligibilityCriteria || 'Not specified'

      // Locations — up to 4
      const locations    = proto?.contactsLocationsModule?.locations || []
      const locationStr  = locations.length
        ? locations.slice(0, 4).map(l => [l.city, l.country].filter(Boolean).join(', ')).join(' | ')
        : location || 'Not specified'

      // Contact info
      const centralContacts = proto?.contactsLocationsModule?.centralContacts || []
      const contact = centralContacts.length
        ? `${centralContacts[0].name || ''} — ${centralContacts[0].email || centralContacts[0].phone || ''}`.trim().replace(/^—\s*/, '')
        : 'Contact not listed'

      // Start date
      const startDate = proto?.statusModule?.startDateStruct?.date || ''

      return {
        id: `ct_${id}`,
        nctId: id,
        title,
        status,
        phase,
        conditions,
        startDate,
        eligibility: eligibility.length > 700
          ? eligibility.slice(0, 700) + '...'
          : eligibility,
        location: locationStr,
        contact,
        url: `https://clinicaltrials.gov/study/${id}`
      }
    }).filter(t => t.nctId)

  } catch (error) {
    console.error('ClinicalTrials error:', error.message)
    return []
  }
}