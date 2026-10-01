import { app } from "@/atoms/kuepa"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Lead, leadService } from "@/services/leadService"
import { Program, programService } from "@/services/programService"
import { LeadForm } from "./components/lead-form"
import { RecentLeads } from "./components/recent-leads"

export interface LeadsProps {
}

export default function Leads (props?: LeadsProps) {
  const { t } = useTranslation()

  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    app.set({
      ...(app.get() || {}),
      app: 'kuepa',
      module: 'leads',
      window: 'crm',
      back: null,
      accent: 'purple',
      breadcrumb:[
        {
          title: 'Leads',
          url: '/leads'
        }
      ]
    })
  }, [])

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true)
    const response = await leadService.list()
    if (response?.code === 200) setLeads(response.list || [])
    setLeadsLoading(false)
  }, [])

  useEffect(() => {
    (async () => {
      const response = await programService.list()
      if (response?.code === 200) setPrograms(response.list || [])
      setProgramsLoading(false)
    })()
    loadLeads()
  }, [loadLeads])

  const onCreated = async (lead: Lead) => {
    setHighlightId(lead._id)
    await loadLeads()
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header className="flex flex-col gap-1 px-1 pt-2 animate-in fade-in slide-in-from-top-1 duration-500">
        <h1 className="flex text-3xl md:text-4xl font-title text-purple-800">{t('leads.form.title')}</h1>
        <p className="max-w-2xl text-sm text-slate-500">{t('leads.form.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <LeadForm programs={programs} programsLoading={programsLoading} onCreated={onCreated} />
        <div className="lg:sticky lg:top-0">
          <RecentLeads leads={leads} loading={leadsLoading} highlightId={highlightId} onRefresh={loadLeads} />
        </div>
      </div>
    </div>
  )
}
