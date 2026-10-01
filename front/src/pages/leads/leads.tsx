import { app } from "@/atoms/kuepa"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { LoaderCircle } from "lucide-react"
import { Lead, LeadScoring, leadService } from "@/services/leadService"
import { Program, programService } from "@/services/programService"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/hooks/use-toast"
import { LeadForm } from "./components/lead-form"
import { RecentLeads } from "./components/recent-leads"
import { ScoringDialog } from "./components/scoring-dialog"

export interface LeadsProps {
}

export default function Leads (props?: LeadsProps) {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState<Lead | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [scoring, setScoring] = useState<Lead | null>(null)

  useEffect(() => {
    app.set({
      ...(app.get() || {}),
      app: 'kuepa',
      module: 'leads',
      window: 'crm',
      back: null,
      accent: 'orange',
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

  const onSaved = async (lead: Lead) => {
    setEditing(null)
    setHighlightId(lead._id)
    await loadLeads()
  }

  const onScored = useCallback((leadId: string, result: LeadScoring) => {
    setLeads((current) => current.map((_l) => _l._id === leadId ? { ..._l, scoring: result } : _l))
  }, [])

  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    const response = await leadService.remove(deleting._id)
    setRemoving(false)

    if (response?.code !== 200) {
      toast({
        variant: 'destructive',
        title: t('leads.form.toast.delete_error_title'),
        description: t(`leads.form.api.${response?.message || 'network'}`, { defaultValue: t('leads.form.api.server.error') }),
      })
      return
    }

    const lead = deleting
    setDeleting(null)
    // Deja correr la animación de salida de la fila antes de quitarla
    setRemovingId(lead._id)
    setTimeout(() => {
      setLeads((current) => current.filter((_l) => _l._id !== lead._id))
      setRemovingId(null)
    }, 300)
    toast({
      title: t('leads.form.toast.deleted_title'),
      description: t('leads.form.toast.deleted_description', { name: lead.full_name, id: lead.incremental }),
    })
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header className="flex flex-col gap-1 px-1 pt-2 animate-in fade-in slide-in-from-top-1 duration-500">
        <h1 className="flex text-3xl md:text-4xl font-title text-orange-800">{t('leads.form.title')}</h1>
        <p className="max-w-2xl text-sm text-slate-500">{t('leads.form.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <LeadForm programs={programs} programsLoading={programsLoading} onSaved={onSaved} />
        <div className="lg:sticky lg:top-0">
          <RecentLeads
            leads={leads}
            loading={leadsLoading}
            highlightId={highlightId}
            removingId={removingId}
            onRefresh={loadLeads}
            onEdit={setEditing}
            onDelete={setDeleting}
            onScore={setScoring}
          />
        </div>
      </div>

      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-slate-100 p-6 pb-4 text-left">
            <SheetTitle className="font-title text-xl text-orange-800">
              {t('leads.form.edit.title', { id: editing?.incremental })}
            </SheetTitle>
            <SheetDescription>{t('leads.form.edit.description')}</SheetDescription>
          </SheetHeader>
          {
            editing ?
              <LeadForm
                key={editing._id}
                lead={editing}
                programs={programs}
                programsLoading={programsLoading}
                onSaved={onSaved}
                onCancel={() => setEditing(null)}
                className="rounded-none border-0 shadow-none"
              />
            : null
          }
        </SheetContent>
      </Sheet>

      <ScoringDialog lead={scoring} onClose={() => setScoring(null)} onScored={onScored} />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && !removing && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('leads.form.delete.title')}</DialogTitle>
            <DialogDescription>
              {t('leads.form.delete.description', { name: deleting?.full_name, id: deleting?.incremental })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setDeleting(null)} disabled={removing}>
              {t('leads.form.actions.cancel')}
            </Button>
            <Button type="button" tone="rose" onClick={confirmDelete} disabled={removing} aria-busy={removing}>
              {removing ? <LoaderCircle className="animate-spin" /> : null}
              {t('leads.form.actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
