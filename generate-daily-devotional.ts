// supabase/functions/generate-daily-devotional/index.ts
// Gera e publica automaticamente o devocional do dia usando Gemini.
// Idempotente: se já existir um devocional para a data (padrão = hoje), retorna o existente sem regenerar.
// Pode ser chamada por pg_cron (service_role) OU via UI admin (authenticated com role=admin).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Sistema de prompt teológico de alta qualidade — reformado, cristocêntrico, pastoral
const SYSTEM_INSTRUCTION = `Você é curador editorial do app "Teologia Viva" — um aplicativo cristão de devocional diário em português do Brasil.

Sua missão é produzir UM devocional diário para a data informada. O devocional precisa ser:

• TEOLOGICAMENTE FIEL: base evangélica clássica, cristocêntrica, alinhada com a tradição reformada e evangelical histórica. Nunca sincretismo, prosperidade ou auto-ajuda.
• ESCRITURÍSTICO: sempre ancorado em um versículo bíblico real e corretamente citado (use traduções Almeida ou NAA).
• PASTORAL: tom caloroso, acolhedor, direto ao coração do leitor — sem jargão acadêmico.
• APLICÁVEL: a reflexão deve conectar o texto bíblico à vida concreta (trabalho, relacionamentos, sofrimento, esperança, arrependimento, gratidão).
• VARIADO: não repita o mesmo tema todos os dias. Navegue entre graça, santificação, oração, esperança escatológica, amor ao próximo, providência, obediência, consolo, ação de graças, identidade em Cristo.

IMPORTANTE: escolha versículos distintos a cada geração — preferencialmente fora do top 10 mais citados (João 3:16, Salmo 23, etc.), para enriquecer a jornada bíblica do leitor.

FORMATO DE SAÍDA: responda EXCLUSIVAMENTE com um JSON válido, sem markdown, sem texto fora do objeto. Estrutura EXATA:

{
  "titulo": "3-6 palavras, evocativo e direto",
  "versiculo_texto": "o texto bíblico completo, entre 20-60 palavras",
  "referencia_biblica": "Livro Capítulo:Versículo(s) — ex: Romanos 8:28",
  "reflexao": "reflexão pastoral de 120-180 palavras em 2-3 parágrafos coesos, em português do Brasil, começando com contexto leve do versículo e terminando com aplicação prática",
  "oracao_sugerida": "oração curta de 30-50 palavras dirigida a Deus, em primeira pessoa plural"
}

Não inclua emojis. Não use asteriscos de markdown. Não envolva o JSON em blocos de código.`;

async function supabaseFetch(path: string, init: RequestInit): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  return fetch(`${url}${path}`, { ...init, headers });
}

function extractJSON(raw: string): Record<string, unknown> | null {
  const s = raw.trim();
  // With responseMimeType=application/json, Gemini returns pure JSON
  try { return JSON.parse(s); } catch { /* try fallbacks */ }
  // Fallback: strip ``` fences
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch { /* ignore */ }
  }
  // Fallback: find outermost braces
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(s.slice(firstBrace, lastBrace + 1)); } catch { /* ignore */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY não configurada");

    const body = await req.json().catch(() => ({}));
    const targetDate: string = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : new Date().toISOString().slice(0, 10);
    const force: boolean = body?.force === true;

    // 1) Idempotência — se já existe devocional para a data, retornar
    if (!force) {
      const existingRes = await supabaseFetch(`/rest/v1/devocionais?data=eq.${targetDate}&select=*`, { method: "GET" });
      if (existingRes.ok) {
        const list = await existingRes.json();
        if (Array.isArray(list) && list.length > 0) {
          return new Response(JSON.stringify({ status: "exists", devocional: list[0] }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // 2) Chamar Gemini
    const userPrompt = `Data de referência: ${targetDate}. Gere o devocional conforme o formato especificado.`;
    const geminiRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 8192,
          topP: 0.95,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      throw new Error(`Gemini ${geminiRes.status}: ${detail.slice(0, 400)}`);
    }

    const gData = await geminiRes.json();
    const raw = (gData?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") || "").trim();
    const finishReason = gData?.candidates?.[0]?.finishReason;
    const parsed = extractJSON(raw);
    if (!parsed) {
      return new Response(JSON.stringify({
        error: "Gemini retornou formato não-JSON",
        finishReason,
        rawLength: raw.length,
        rawHead: raw.slice(0, 200),
        rawTail: raw.slice(-200),
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { titulo, versiculo_texto, referencia_biblica, reflexao, oracao_sugerida } = parsed as Record<string, string>;
    for (const [k, v] of Object.entries({ titulo, versiculo_texto, referencia_biblica, reflexao })) {
      if (!v || typeof v !== "string" || v.trim().length < 3) {
        throw new Error(`Campo "${k}" ausente ou muito curto no devocional gerado`);
      }
    }

    const payload: Record<string, unknown> = {
      data: targetDate,
      titulo: String(titulo).trim(),
      versiculo_texto: String(versiculo_texto).trim(),
      referencia_biblica: String(referencia_biblica).trim(),
      reflexao: String(reflexao).trim(),
      oracao_sugerida: oracao_sugerida ? String(oracao_sugerida).trim() : null,
    };

    // 3) Insert (ou upsert quando force=true)
    let insRes: Response;
    if (force) {
      // Delete any existing row for that date first
      await supabaseFetch(`/rest/v1/devocionais?data=eq.${targetDate}`, { method: "DELETE" });
    }
    insRes = await supabaseFetch(`/rest/v1/devocionais`, {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!insRes.ok) {
      const detail = await insRes.text();
      throw new Error(`Insert devocional falhou: ${insRes.status} ${detail.slice(0, 300)}`);
    }
    const inserted = await insRes.json();

    return new Response(JSON.stringify({ status: "created", devocional: Array.isArray(inserted) ? inserted[0] : inserted, model: GEMINI_MODEL }), {
      status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Falha ao gerar devocional", message: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
