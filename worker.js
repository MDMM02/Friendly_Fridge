export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON" }, 400);

    const { inventory, preferences } = body;

    if (!Array.isArray(inventory) || inventory.length === 0) {
      return json({ error: "inventory is required" }, 400);
    }

    const system = `
You are a helpful cooking assistant.
Return ONLY valid JSON.
Never invent ingredients that are not in inventory unless listed under missing_ingredients.
Prefer using items that expire sooner (lower days_to_expiry).
Keep recipes simple and realistic for a student budget.
`;

    // We precompute days_to_expiry on the client ideally, but you can do it there too.
    const user = {
      inventory,
      preferences: preferences ?? {
        max_time_minutes: 30,
        servings: 1,
        style: "balanced",
        prioritize_expiry: true,
        avoid: []
      },
      output_schema: {
        recipes: "Array of 5 recipes with title,time_minutes,difficulty,servings,uses_soon_to_expire,ingredients_used,missing_ingredients,steps,tips"
      }
    };

   const fullPrompt = system.trim() + "\n\n" + JSON.stringify(user);

    const payload = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        responseMimeType: "application/json"  // force JSON output natif Gemini
      }
    };

     const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await r.json();
    if (!r.ok) {
      return json({ error: "Model API error", details: data }, 500);
    }

    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return json({ error: "Empty model response" }, 500);

    // validate JSON
    let parsed;
    try { parsed = JSON.parse(content); }
    catch { return json({ error: "Model did not return valid JSON", raw: content }, 500); }

    return json(parsed, 200);
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}