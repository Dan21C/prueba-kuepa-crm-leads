import config from 'config'

interface IChatJSONParams {
  system: string
  user: string
  temperature?: number
}

/**
* Cliente mínimo de OpenAI Chat Completions con `fetch` nativo (Node 18+), sin SDK.
* Devuelve el JSON que responde el modelo o `null` si no hay API key, hay timeout o la respuesta no es válida,
* para que quien lo use siempre tenga un camino de respaldo.
*/
class OpenaiUtility {

  private url = 'https://api.openai.com/v1/chat/completions'
  private timeout = 15000

  public get enabled () {
    return !!config.openai.key
  }

  public get model () {
    return config.openai.model
  }

  public async chatJSON<T = any> (_params: IChatJSONParams): Promise<T | null> {
    if (!this.enabled) return null

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try{
      const response = await fetch(this.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openai.key}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: _params.temperature ?? 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: _params.system },
            { role: 'user', content: _params.user },
          ],
        }),
      })

      if (!response.ok) {
        console.log('error', `openai ${response.status}`, await response.text())
        return null
      }

      const data: any = await response.json()
      const content = data?.choices?.[0]?.message?.content
      return content ? JSON.parse(content) as T : null
    } catch (error) {
      console.log('error', error)
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}

export const openaiUtility = new OpenaiUtility()
export { OpenaiUtility }
