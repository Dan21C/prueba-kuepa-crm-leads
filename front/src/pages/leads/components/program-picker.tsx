import { KeyboardEvent, useRef } from "react"
import { useTranslation } from "react-i18next"
import { BookOpen, Calculator, Check, GraduationCap, Languages, Laptop, Baby, Briefcase } from "lucide-react"
import { Program } from "@/services/programService"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const ICONS: Array<[RegExp, typeof GraduationCap]> = [
  [/bachiller/i, BookOpen],
  [/administra/i, Briefcase],
  [/sistemas/i, Laptop],
  [/contab|finanz/i, Calculator],
  [/ingl[eé]s/i, Languages],
  [/infancia/i, Baby],
]

const iconFor = (name: string) => ICONS.find(([pattern]) => pattern.test(name))?.[1] || GraduationCap

export interface ProgramPickerProps {
  id: string
  programs: Program[]
  loading?: boolean
  value: string
  invalid?: boolean
  describedBy?: string
  onChange: (value: string) => void
  onBlur?: () => void
}

/**
* Grid de tarjetas seleccionables con semántica de radiogroup (flechas para moverse).
*/
export function ProgramPicker ({ id, programs, loading, value, invalid, describedBy, onChange, onBlur }: ProgramPickerProps) {
  const { t } = useTranslation()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    if (!(event.key in keys)) return
    event.preventDefault()
    const next = (index + keys[event.key] + programs.length) % programs.length
    refs.current[next]?.focus()
    onChange(programs[next]._id)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[76px] rounded-lg" />)}
      </div>
    )
  }

  if (!programs.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">{t('leads.form.program.empty')}</p>
  }

  const focusable = value ? value : programs[0]._id

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={t('leads.form.program.label')}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn("grid grid-cols-1 gap-3 rounded-lg sm:grid-cols-2", invalid && "ring-1 ring-rose-400 ring-offset-4")}
    >
      {programs.map((program, index) => {
        const Icon = iconFor(program.name)
        const selected = program._id === value
        return (
          <button
            key={program._id}
            ref={(element) => { refs.current[index] = element }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={program._id === focusable ? 0 : -1}
            onClick={() => onChange(program._id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            onBlur={onBlur}
            className={cn(
              "group relative flex items-start gap-3 rounded-lg border p-3 text-left transition-all duration-200",
              "hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 motion-reduce:hover:translate-y-0",
              selected ? "border-orange-500 bg-orange-50 shadow-sm" : "border-slate-200 bg-white"
            )}
          >
            <span className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
              selected ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-orange-100 group-hover:text-orange-800"
            )}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn("text-sm font-medium leading-5", selected ? "text-orange-900" : "text-slate-800")}>{program.name}</span>
              {program.description ? <span className="line-clamp-2 text-xs text-slate-500">{program.description}</span> : null}
            </span>
            {
              selected ?
                <Check aria-hidden className="absolute right-2 top-2 h-4 w-4 text-orange-500 animate-in zoom-in-50 fade-in duration-200" />
              : null
            }
          </button>
        )
      })}
    </div>
  )
}
