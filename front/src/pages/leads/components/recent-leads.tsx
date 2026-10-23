import { useTranslation } from "react-i18next"
import moment from "moment"
// Vite resuelve moment a su build ESM (jsnext:main); el idioma debe registrarse sobre esa misma instancia
import 'moment/dist/locale/es'
import { Cake, GraduationCap, Inbox, MoreHorizontal, Pencil, RefreshCw, Target, Trash2 } from "lucide-react"
import { Lead, LeadStatus } from "@/services/leadService"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { LEVEL_STYLES } from "./scoring-dialog"

const STATUS_STYLES: Record<LeadStatus, string> = {
  active: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  grading: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  sold: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  dropped: 'bg-rose-50 text-rose-800 ring-rose-600/20',
  inactive: 'bg-slate-100 text-slate-700 ring-slate-500/20',
}

export interface RecentLeadsProps {
  leads: Lead[]
  loading: boolean
  highlightId?: string | null
  removingId?: string | null
  onRefresh: () => void
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onScore: (lead: Lead) => void
}

export function RecentLeads ({ leads, loading, highlightId, removingId, onRefresh, onEdit, onDelete, onScore }: RecentLeadsProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('en') ? 'en' : 'es'

  return (
    <Card className="shadow-sm animate-in fade-in slide-in-from-right-2 duration-500 fill-mode-both" style={{ animationDelay: '200ms' }}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-title text-lg text-slate-800">{t('leads.form.recent.title')}</CardTitle>
          <CardDescription>{t('leads.form.recent.description')}</CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          accent="orange"
          onClick={onRefresh}
          disabled={loading}
          aria-label={t('leads.form.recent.refresh')}
          title={t('leads.form.recent.refresh')}
        >
          <RefreshCw className={cn(loading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
        {
          loading && !leads.length ?
            <div className="flex flex-col gap-2" aria-busy="true" aria-label={t('leads.form.recent.loading')}>
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          : !leads.length ?
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center animate-in fade-in duration-500">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-700">
                <Inbox className="h-6 w-6" />
              </span>
              <p className="font-medium text-slate-800">{t('leads.form.recent.empty_title')}</p>
              <p className="max-w-xs text-sm text-slate-500">{t('leads.form.recent.empty_description')}</p>
            </div>
          :
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('leads.form.recent.name')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('leads.form.recent.program')}</TableHead>
                  <TableHead>{t('leads.form.recent.status')}</TableHead>
                  <TableHead className="text-right">{t('leads.form.recent.date')}</TableHead>
                  <TableHead className="w-10"><span className="sr-only">{t('leads.form.recent.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.slice(0, 10).map((lead) => (
                  <TableRow
                    key={lead._id}
                    className={cn(
                      "transition-colors duration-1000",
                      lead._id === highlightId && "bg-orange-50/80 animate-in fade-in slide-in-from-top-2 duration-500",
                      lead._id === removingId && "pointer-events-none bg-rose-50/60 animate-out fade-out slide-out-to-right-4 fill-mode-forwards duration-300"
                    )}
                  >
                    <TableCell className="py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">{lead.full_name || '—'}</span>
                        <span className="text-xs text-slate-500">
                          #{lead.incremental} · {t(`leads.form.source.options.${lead.source}`)}
                        </span>
                        {
                          lead.birth_date || lead.education_level ?
                            <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                              {
                                lead.birth_date ?
                                  <span className="inline-flex items-center gap-1" title={moment.utc(lead.birth_date).locale(locale).format('LL')}>
                                    <Cake className="h-3 w-3 text-orange-500" aria-hidden />
                                    {t('leads.form.recent.age', { count: moment().diff(moment.utc(lead.birth_date), 'years') })}
                                  </span>
                                : null
                              }
                              {
                                lead.education_level ?
                                  <span className="inline-flex items-center gap-1">
                                    <GraduationCap className="h-3 w-3 text-orange-500" aria-hidden />
                                    {t(`leads.form.education_levels.${lead.education_level}`)}
                                  </span>
                                : null
                              }
                            </span>
                          : null
                        }
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[160px] truncate py-2 text-slate-600 sm:table-cell" title={lead.interestProgram?.name}>
                      {lead.interestProgram?.name || '—'}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex flex-col items-start gap-1">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_STYLES[lead.status] || STATUS_STYLES.inactive)}>
                          {t(`leads.form.status.${lead.status}`)}
                        </span>
                        {
                          lead.scoring ?
                            <button
                              type="button"
                              onClick={() => onScore(lead)}
                              title={t('leads.form.scoring.chip_title')}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[11px] font-medium tabular-nums ring-1 ring-inset transition-transform hover:scale-105 animate-in fade-in zoom-in-95 duration-300",
                                LEVEL_STYLES[lead.scoring.level].chip
                              )}
                            >
                              <Target className="h-3 w-3" />
                              {lead.scoring.score}
                            </button>
                          : null
                        }
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-2 text-right text-xs text-slate-500" title={moment(lead.created_at).locale(locale).format('LLL')}>
                      {moment(lead.created_at).locale(locale).fromNow()}
                    </TableCell>
                    <TableCell className="py-2 pl-0 pr-1 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            accent="orange"
                            className="h-8 w-8"
                            aria-label={t('leads.form.recent.actions_for', { name: lead.full_name })}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onSelect={() => onScore(lead)} className="gap-2">
                            <Target className="h-4 w-4" />
                            {t('leads.form.actions.score')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onEdit(lead)} className="gap-2">
                            <Pencil className="h-4 w-4" />
                            {t('leads.form.actions.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => onDelete(lead)} className="gap-2 text-rose-700 focus:bg-rose-50 focus:text-rose-800">
                            <Trash2 className="h-4 w-4" />
                            {t('leads.form.actions.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        }
      </CardContent>
    </Card>
  )
}
