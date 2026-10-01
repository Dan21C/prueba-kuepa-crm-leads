import { useTranslation } from "react-i18next"
import { Database, LayoutDashboard, PhoneCall, Rocket } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const FEATURES = [
  { key: 'dashboard', icon: LayoutDashboard },
  { key: 'queue', icon: PhoneCall },
  { key: 'demo', icon: Database },
] as const

/**
* Anuncia las funciones planeadas (ver "Mejoras futuras" en el README). No es interactiva.
*/
export function ComingSoon () {
  const { t } = useTranslation()

  return (
    <Card
      aria-labelledby="coming-soon-title"
      className="border-dashed border-orange-300 bg-orange-50/40 shadow-none animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
      style={{ animationDelay: '400ms' }}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle id="coming-soon-title" className="flex items-center gap-2 font-title text-base text-slate-800">
            <Rocket className="h-4 w-4 text-orange-500" aria-hidden />
            {t('leads.form.coming_soon.title')}
          </CardTitle>
          <CardDescription>{t('leads.form.coming_soon.description')}</CardDescription>
        </div>
        <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
          {t('leads.form.coming_soon.badge')}
        </span>
      </CardHeader>
      <CardContent className="pb-4">
        <ul className="flex flex-col gap-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-orange-600 ring-1 ring-orange-200" aria-hidden>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-800">{t(`leads.form.coming_soon.items.${key}.title`)}</span>
                <span className="text-xs text-slate-500">{t(`leads.form.coming_soon.items.${key}.description`)}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
