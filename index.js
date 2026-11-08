/** Host half of the DeepSeek availability bundle.
 * Registers a same-origin HTTP route the browser half polls; each poll runs a
 * fresh reachability check against the DeepSeek API from the Host (no browser
 * CORS applies) and, when a DeepSeek API key is configured, lists the real
 * model roster from `/models`. Returns lossless JSON.
 */

const API_MODELS_URL = 'https://api.deepseek.com/models';
const CHAT_URL = 'https://chat.deepseek.com/';
const API_KEY_REF = 'DEEPSEEK_API_KEY';
const TIMEOUT_MS = 5000;

/** Advisory roster used when no API key is available to list real models. */
const STATIC_MODELS = [
  { id: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
];

function errorKind(error) {
  if (error && error.name === 'AbortError') return 'timeout';
  if (error && error.cause && error.cause.code) return error.cause.code;
  if (error && error.name) return error.name;
  return 'network';
}

/** Probe a URL and normalize the outcome to JSON-safe fields (body is not read). */
async function probe(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      ...(headers ? { headers } : {}),
    });
    res.body?.cancel().catch(() => {});
    return { ok: true, status: res.status, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error: errorKind(error), latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/** Read the configured DeepSeek API key, or undefined when none is available. */
async function resolveApiKey(ctx) {
  try {
    const credentials = ctx.get('credentials');
    if (!credentials) return undefined;
    const hit = await credentials.resolve(API_KEY_REF);
    return hit && hit.value ? hit.value : undefined;
  } catch {
    return undefined;
  }
}

/** List models from `/models` using the key; returns [] when unavailable. */
async function fetchModelList(apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_MODELS_URL, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { authorization: 'Bearer ' + apiKey },
    });
    if (res.status !== 200) {
      res.body?.cancel().catch(() => {});
      return [];
    }
    const payload = await res.json();
    const data = payload && Array.isArray(payload.data) ? payload.data : [];
    return data
      .filter((m) => m && typeof m.id === 'string')
      .map((m) => ({ id: m.id, available: true }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function apply(ctx) {
  ctx.inject(['webServer'], (webCtx) => {
    const route = {
      kind: 'exact',
      path: '/deepseek-availability',
      resource: async () => {
        const checkedAt = new Date().toISOString();
        const apiKey = await resolveApiKey(ctx);

        const [apiOutcome, chatOutcome] = await Promise.all([
          probe(API_MODELS_URL, apiKey ? { authorization: 'Bearer ' + apiKey } : undefined),
          probe(CHAT_URL),
        ]);

        let models = apiKey ? await fetchModelList(apiKey) : [];
        const authenticated = models.length > 0;
        if (models.length === 0) {
          models = STATIC_MODELS.map((m) => ({ ...m, available: apiOutcome.ok }));
        }

        const available = apiOutcome.ok;

        return new Response(
          JSON.stringify({
            checkedAt,
            available,
            authenticated,
            models,
            endpoints: [
              {
                id: 'api',
                url: API_MODELS_URL,
                ok: apiOutcome.ok,
                status: apiOutcome.status,
                latencyMs: apiOutcome.latencyMs,
                error: apiOutcome.error,
              },
              {
                id: 'chat',
                url: CHAT_URL,
                ok: chatOutcome.ok,
                status: chatOutcome.status,
                latencyMs: chatOutcome.latencyMs,
                error: chatOutcome.error,
              },
            ],
          }),
          {
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            },
          },
        );
      },
    };
    webCtx.effect(
      () => webCtx.webServer.register(route),
      'deepseek-availability: status route',
    );
  });
}
