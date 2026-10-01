import { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface FormFieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  className?: string
  children: ReactNode
}

export const fieldErrorId = (id: string) => `${id}-error`

export function FormField ({ id, label, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className={cn("text-slate-700", error && "text-rose-700")}>
        {label}
      </Label>
      {children}
      {
        error ?
          <p id={fieldErrorId(id)} role="alert" className="text-xs text-rose-600 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </p>
        : hint ?
          <p className="text-xs text-slate-500">{hint}</p>
        : null
      }
    </div>
  )
}
