import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface FormSectionProps {
  step: number
  title: string
  description?: string
  done?: boolean
  delay?: number
  children: ReactNode
}

export function FormSection ({ step, title, description, done, delay = 0, children }: FormSectionProps) {
  return (
    <section
      aria-labelledby={`lead-section-${step}`}
      className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-300",
            done ? "border-purple-700 bg-purple-700 text-white" : "border-purple-200 bg-purple-50 text-purple-800"
          )}
        >
          {step}
        </span>
        <div>
          <h2 id={`lead-section-${step}`} className="font-title text-lg font-semibold leading-7 text-slate-800">{title}</h2>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
      </header>
      <div className="flex flex-col gap-4 md:pl-10">
        {children}
      </div>
    </section>
  )
}
