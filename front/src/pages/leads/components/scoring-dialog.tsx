import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import moment from "moment"
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, Sparkles, Target } from "lucide-react"
import { Lead, LeadScoring, ScoringLevel, leadService } from "@/services/leadService"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export const LEVEL_STYLES: Record<ScoringLevel, { text: string, stroke: string, bar: string, chip: string }> = {
  high: { text: 'text-emerald-700', stroke: 'stroke-emerald-500', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20' },
  medium: { text: 'text-amber-700', stroke: 'stroke-amber-500', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  low: { text: 'text-rose-700', stroke: 'stroke-rose-500', bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-800 ring-rose-600/20' },
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Anima un número de 0 al valor final (se salta si el usuario prefiere menos movimiento) */
function useCountUp (target: number, duration = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setValue(target)
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

function ScoreGauge ({ scoring }: { scoring: LeadScoring }) {
  const { t } = useTranslation()
  const value = useCountUp(scoring.score)
  const styles = LEVEL_STYLES[scoring.level]

  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={t('leads.form.scoring.gauge_label', { score: scoring.score, level: t(`leads.form.scoring.levels.${scoring.level}`) })}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={RADIUS} className="fill-none stroke-slate-100" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          className={cn("fill-none transition-[stroke-dashoffset] duration-1000 ease-out", styles.stroke)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - value / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-semibold tabular-nums", styles.text)}>{value}</span>
        <span className="text-xs text-slate-500">/ 100</span>
      </div>
    </div>
  )
}

export interface ScoringDialogProps {
  lead: Lead | null
  onClose: () => void
  onScored: (leadId: string, scoring: LeadScoring) => void
}

export function ScoringDialog ({ lead, onClose, onScored }: ScoringDialogProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('en') ? 'en' : 'es'
  const [scoring, setScoring] = useState<LeadScoring | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const analyze = useCallback(async (target: Lead) => {
    setLoading(true)
    setError(false)
    const response = await leadService.score(target._id)
    setLoading(false)
    if (response?.code !== 200) return setError(true)
    setScoring(response.object)
    onScored(target._id, response.object)
  }, [onScored])

  // Al abrir: muestra el último análisis guardado o calcula uno nuevo
  useEffect(() => {
    if (!lead) return
    setScoring(lead.scoring || null)
    if (!lead.scoring) analyze(lead)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?._id])

  const styles = scoring ? LEVEL_STYLES[scoring.level] : null

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-title text-xl text-orange-800">
            <Target className="h-5 w-5" />
            {t('leads.form.scoring.title')}
          </DialogTitle>
          <DialogDescription>
            {t('leads.form.scoring.description', { name: lead?.full_name, program: lead?.interestProgram?.name || '—' })}
          </DialogDescription>
        </DialogHeader>

        {
          loading && !scoring ?
            <div className="flex flex-col items-center gap-4 py-6" aria-busy="true">
              <Skeleton className="h-36 w-36 rounded-full" />
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {t('leads.form.scoring.analyzing')}
              </p>
            </div>
          : error && !scoring ?
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{t('leads.form.scoring.error')}</p>
          : scoring && styles ?
            <div key={scoring.evaluated_at} className="flex flex-col gap-5 animate-in fade-in duration-300">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <ScoreGauge scoring={scoring} />
                <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset", styles.chip)}>
                    {t(`leads.form.scoring.levels.${scoring.level}`)}
                  </span>
                  <p className="text-sm text-slate-700">
                    {scoring.summary || t(`leads.form.scoring.rules_summary.${scoring.level}`)}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    {scoring.engine === 'openai' ? <Sparkles className="h-3.5 w-3.5 text-orange-600" /> : null}
                    {
                      scoring.engine === 'openai'
                        ? t('leads.form.scoring.engine_openai', { model: scoring.model, rule: scoring.rule_score })
                        : t('leads.form.scoring.engine_rules')
                    }
                    {' · '}
                    {moment(scoring.evaluated_at).locale(locale).fromNow()}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-orange-700">{t('leads.form.scoring.next_action')}</p>
                <p className="mt-1 text-sm font-medium text-orange-950">
                  {scoring.next_action || t(`leads.form.scoring.next.${scoring.next_action_key}`)}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-slate-700">{t('leads.form.scoring.factors_title')}</p>
                {scoring.factors.map((factor, index) => (
                  <div key={factor.key} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-sm">
                    <span className="text-slate-600">{t(`leads.form.scoring.factors.${factor.key}`)}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full origin-left rounded-full animate-grow-x", styles.bar)}
                        style={{ width: `${(factor.points / factor.max) * 100}%`, animationDelay: `${150 + index * 80}ms` }}
                      />
                    </div>
                    <span className="text-right text-xs tabular-nums text-slate-500">{factor.points}/{factor.max}</span>
                  </div>
                ))}
              </div>

              {
                scoring.strengths?.length || scoring.risks?.length ?
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {
                      scoring.strengths?.length ?
                        <ul className="flex flex-col gap-1.5 text-sm">
                          <li className="font-medium text-slate-700">{t('leads.form.scoring.strengths')}</li>
                          {scoring.strengths.map((item) => (
                            <li key={item} className="flex gap-2 text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>
                          ))}
                        </ul>
                      : null
                    }
                    {
                      scoring.risks?.length ?
                        <ul className="flex flex-col gap-1.5 text-sm">
                          <li className="font-medium text-slate-700">{t('leads.form.scoring.risks')}</li>
                          {scoring.risks.map((item) => (
                            <li key={item} className="flex gap-2 text-slate-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{item}</li>
                          ))}
                        </ul>
                      : null
                    }
                  </div>
                : scoring.engine === 'rules' ?
                  <p className="text-xs text-slate-500">{t('leads.form.scoring.ai_hint')}</p>
                : null
              }

              <div className="flex justify-end border-t border-slate-100 pt-3">
                <Button type="button" variant="ghost" accent="orange" onClick={() => lead && analyze(lead)} disabled={loading}>
                  {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                  {t('leads.form.scoring.recalculate')}
                </Button>
              </div>
            </div>
          : null
        }
      </DialogContent>
    </Dialog>
  )
}
