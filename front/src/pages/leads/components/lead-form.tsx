import { FormEvent, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CalendarDays, Globe, LoaderCircle, PenLine, Share2, UserRoundCheck, Users } from "lucide-react"
import { CheckContactResponse, Lead, LeadPayload, LeadSource, leadService } from "@/services/leadService"
import { Program } from "@/services/programService"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/components/hooks/use-toast"
import { cn } from "@/lib/utils"
import { FormField, fieldErrorId } from "./form-field"
import { FormSection } from "./form-section"
import { ProgramPicker } from "./program-picker"
import {
  emptyLead, FieldErrors, LeadField, normalizeDocument, normalizeNumber, NOTES_MAX, REQUIRED_FIELDS, validateField, validateLead
} from "../lead-validation"

const DOCUMENT_TYPES = ['cc', 'ti', 'pp', 'nt'] as const
const CONTACT_FIELDS: LeadField[] = ['document', 'email', 'number']
const SOURCES: Array<{ value: LeadSource, icon: typeof Globe }> = [
  { value: 'manual', icon: PenLine },
  { value: 'web', icon: Globe },
  { value: 'referral', icon: Users },
  { value: 'event', icon: CalendarDays },
  { value: 'social', icon: Share2 },
]
const SECTIONS: LeadField[][] = [
  ['first_name', 'last_name', 'document_type', 'document'],
  ['email', 'number'],
  ['interestProgram'],
]

export interface LeadFormProps {
  programs: Program[]
  programsLoading: boolean
  onCreated: (lead: Lead) => void
}

export function LeadForm ({ programs, programsLoading, onCreated }: LeadFormProps) {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [values, setValues] = useState<LeadPayload>(emptyLead)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Partial<Record<LeadField, boolean>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [duplicate, setDuplicate] = useState<CheckContactResponse | null>(null)
  const checkRequest = useRef(0)

  const valid = useMemo(() => {
    const result = {} as Record<LeadField, boolean>
    for (const field of REQUIRED_FIELDS) result[field] = !validateField(field, values)
    return result
  }, [values])

  const progress = Math.round((REQUIRED_FIELDS.filter((field) => valid[field]).length / REQUIRED_FIELDS.length) * 100)

  const message = (field: LeadField) => {
    const code = errors[field]
    if (!code) return undefined
    return t(`leads.form.errors.${field}.${code}`, { defaultValue: t(`leads.form.errors.${code}`) })
  }

  const a11y = (field: LeadField) => ({
    id: `lead-${field}`,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? fieldErrorId(`lead-${field}`) : undefined,
  })

  const inputClass = (field: LeadField) => cn(
    "h-10 border-slate-300",
    errors[field] && "border-rose-500 focus-visible:ring-rose-500"
  )

  const setError = (field: LeadField, next: LeadPayload) => {
    setErrors((current) => ({ ...current, [field]: validateField(field, next) }))
  }

  const change = (field: LeadField, value: string) => {
    const next = { ...values, [field]: value }
    setValues(next)
    // Si el campo ya mostró error, se revalida mientras se corrige
    if (touched[field] || errors[field]) setError(field, next)
    if (field === 'document_type' && touched.document) setError('document', next)
  }

  const checkContact = async (next: LeadPayload) => {
    const params: Partial<LeadPayload> = {}
    if (!validateField('document', next)) params.document = normalizeDocument(next.document)
    if (!validateField('email', next)) params.email = next.email.trim().toLowerCase()
    if (!validateField('number', next)) params.number = normalizeNumber(next.number)
    if (!Object.keys(params).length) return setDuplicate(null)

    const request = ++checkRequest.current
    const response = await leadService.checkContact(params)
    if (request !== checkRequest.current || response?.code !== 200) return
    setDuplicate(response.exists ? response : null)
  }

  const blur = (field: LeadField) => {
    setTouched((current) => ({ ...current, [field]: true }))
    setError(field, values)
    if (CONTACT_FIELDS.includes(field)) checkContact(values)
  }

  const reset = () => {
    setValues(emptyLead())
    setErrors({})
    setTouched({})
    setDuplicate(null)
  }

  const focusFirstError = (fieldErrors: FieldErrors) => {
    const first = (Object.keys(values) as LeadField[]).find((field) => fieldErrors[field])
    if (first) document.getElementById(`lead-${first}`)?.focus()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    const fieldErrors = validateLead(values)
    setErrors(fieldErrors)
    setTouched(Object.fromEntries(Object.keys(values).map((field) => [field, true])))
    if (Object.keys(fieldErrors).length) return focusFirstError(fieldErrors)

    setSubmitting(true)
    const response = await leadService.create({
      ...values,
      document: normalizeDocument(values.document),
      number: normalizeNumber(values.number),
    })
    setSubmitting(false)

    if (response?.code === 201 || response?.code === 200) {
      toast({
        title: t('leads.form.toast.success_title'),
        description: t('leads.form.toast.success_description', { name: response.object?.contact?.first_name, id: response.object?.incremental }),
      })
      reset()
      onCreated(response.object)
      return
    }

    if (response?.fields) {
      setErrors((current) => ({ ...current, ...response.fields }))
      focusFirstError(response.fields)
    }
    if (response?.code === 409 && response.object) {
      setDuplicate({ exists: true, contact: response.object.contact, lead: response.object })
    }

    toast({
      variant: 'destructive',
      title: t('leads.form.toast.error_title'),
      description: t(`leads.form.api.${response?.message || 'network'}`, { defaultValue: t('leads.form.api.server.error') }),
    })
  }

  return (
    <Card className="shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
      <CardContent className="p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t('leads.form.progress')}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={t('leads.form.progress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-1.5 w-full overflow-hidden rounded-full bg-purple-100"
          >
            <div className="h-full rounded-full bg-purple-700 transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <form noValidate onSubmit={submit} className="flex flex-col gap-8">
          <FormSection
            step={1}
            delay={100}
            title={t('leads.form.sections.personal.title')}
            description={t('leads.form.sections.personal.description')}
            done={SECTIONS[0].every((field) => valid[field])}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="lead-first_name" label={t('leads.form.fields.first_name')} error={message('first_name')}>
                <Input
                  {...a11y('first_name')}
                  autoComplete="given-name"
                  placeholder={t('leads.form.placeholders.first_name')}
                  value={values.first_name}
                  onChange={(event) => change('first_name', event.target.value)}
                  onBlur={() => blur('first_name')}
                  className={inputClass('first_name')}
                />
              </FormField>
              <FormField id="lead-last_name" label={t('leads.form.fields.last_name')} error={message('last_name')}>
                <Input
                  {...a11y('last_name')}
                  autoComplete="family-name"
                  placeholder={t('leads.form.placeholders.last_name')}
                  value={values.last_name}
                  onChange={(event) => change('last_name', event.target.value)}
                  onBlur={() => blur('last_name')}
                  className={inputClass('last_name')}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
              <FormField id="lead-document_type" label={t('leads.form.fields.document_type')} error={message('document_type')}>
                <Select value={values.document_type} onValueChange={(value) => change('document_type', value)}>
                  <SelectTrigger {...a11y('document_type')} className={inputClass('document_type')}>
                    <SelectValue placeholder={t('leads.form.placeholders.document_type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{t(`leads.form.document_types.${type}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                id="lead-document"
                label={t('leads.form.fields.document')}
                error={message('document')}
                hint={t(values.document_type === 'pp' ? 'leads.form.hints.passport' : 'leads.form.hints.document')}
              >
                <Input
                  {...a11y('document')}
                  inputMode={values.document_type === 'pp' ? 'text' : 'numeric'}
                  placeholder={t('leads.form.placeholders.document')}
                  value={values.document}
                  onChange={(event) => change('document', event.target.value)}
                  onBlur={() => blur('document')}
                  className={inputClass('document')}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            step={2}
            delay={200}
            title={t('leads.form.sections.contact.title')}
            description={t('leads.form.sections.contact.description')}
            done={SECTIONS[1].every((field) => valid[field])}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="lead-email" label={t('leads.form.fields.email')} error={message('email')}>
                <Input
                  {...a11y('email')}
                  type="email"
                  autoComplete="email"
                  placeholder={t('leads.form.placeholders.email')}
                  value={values.email}
                  onChange={(event) => change('email', event.target.value)}
                  onBlur={() => blur('email')}
                  className={inputClass('email')}
                />
              </FormField>
              <FormField id="lead-number" label={t('leads.form.fields.number')} error={message('number')} hint={t('leads.form.hints.number')}>
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-slate-300 px-3 text-sm text-slate-500">
                    +57
                  </span>
                  <Input
                    {...a11y('number')}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder={t('leads.form.placeholders.number')}
                    value={values.number}
                    onChange={(event) => change('number', normalizeNumber(event.target.value))}
                    onBlur={() => blur('number')}
                    className={cn(inputClass('number'), "pl-14 tabular-nums")}
                  />
                </div>
              </FormField>
            </div>

            {
              duplicate?.exists ?
                <Alert
                  variant="purple"
                  aria-live="polite"
                  className={cn(
                    "animate-in fade-in slide-in-from-top-2 duration-300",
                    duplicate.lead ? "border-amber-500/60 bg-amber-50 text-amber-900" : "bg-purple-50 text-purple-900"
                  )}
                >
                  <UserRoundCheck className="h-4 w-4" />
                  <AlertTitle>{t('leads.form.duplicate.title')}</AlertTitle>
                  <AlertDescription className="text-sm">
                    {
                      duplicate.lead ?
                        t('leads.form.duplicate.active_lead', {
                          name: `${duplicate.contact?.first_name || ''} ${duplicate.contact?.last_name || ''}`.trim(),
                          id: duplicate.lead.incremental,
                          program: duplicate.lead.interestProgram?.name || '—',
                        })
                      :
                        t('leads.form.duplicate.reuse', {
                          name: `${duplicate.contact?.first_name || ''} ${duplicate.contact?.last_name || ''}`.trim(),
                        })
                    }
                  </AlertDescription>
                </Alert>
              : null
            }
          </FormSection>

          <FormSection
            step={3}
            delay={300}
            title={t('leads.form.sections.program.title')}
            description={t('leads.form.sections.program.description')}
            done={valid.interestProgram}
          >
            <FormField id="lead-interestProgram" label={t('leads.form.program.label')} error={message('interestProgram')}>
              <ProgramPicker
                id="lead-interestProgram"
                programs={programs}
                loading={programsLoading}
                value={values.interestProgram}
                invalid={!!errors.interestProgram}
                describedBy={errors.interestProgram ? fieldErrorId('lead-interestProgram') : undefined}
                onChange={(value) => {
                  change('interestProgram', value)
                  setErrors((current) => ({ ...current, interestProgram: undefined }))
                }}
              />
            </FormField>

            <div className="flex flex-col gap-1.5">
              <span id="lead-source-label" className="text-sm font-medium leading-none text-slate-700">{t('leads.form.source.label')}</span>
              <ToggleGroup
                type="single"
                aria-labelledby="lead-source-label"
                value={values.source}
                onValueChange={(value) => value && change('source', value)}
                className="flex-wrap justify-start"
              >
                {SOURCES.map(({ value, icon: Icon }) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 px-3 transition-all data-[state=on]:border-purple-600 data-[state=on]:bg-purple-100 data-[state=on]:text-purple-900"
                  >
                    <Icon />
                    {t(`leads.form.source.options.${value}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <FormField id="lead-notes" label={t('leads.form.fields.notes')} error={message('notes')}>
              <Textarea
                {...a11y('notes')}
                rows={3}
                maxLength={NOTES_MAX}
                placeholder={t('leads.form.placeholders.notes')}
                value={values.notes}
                onChange={(event) => change('notes', event.target.value)}
                onBlur={() => blur('notes')}
                className={cn("resize-none border-slate-300", errors.notes && "border-rose-500")}
              />
              <span className="self-end text-xs tabular-nums text-slate-400">{values.notes.length}/{NOTES_MAX}</span>
            </FormField>
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" accent="purple" onClick={reset} disabled={submitting}>
              {t('leads.form.actions.reset')}
            </Button>
            <Button type="submit" tone="purple" disabled={submitting} aria-busy={submitting} className="min-w-40 active:scale-[0.98]">
              {submitting ? <LoaderCircle className="animate-spin" /> : null}
              {submitting ? t('leads.form.actions.submitting') : t('leads.form.actions.submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
