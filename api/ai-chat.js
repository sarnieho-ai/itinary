import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a friendly, knowledgeable Chengdu travel assistant helping a family from Singapore (2 adults + 1 child aged 5) plan their trip.

Trip details:
- Dates: March 28 - April 3, 2026 (spring, ~12-22°C)
- Flight in: SQ 842, lands 06:55 Mar 28 at Tianfu International T1
- Flight out: SQ 843, departs 18:25 Apr 3 from Tianfu International T1
- Hotel: Lyhn International Hotel Chengdu Taikoo Li, No.1 Tidu Street, Jinjiang District
- Day 1: Sat Mar 28 (Arrival), Day 2: Sun Mar 29, Day 3: Mon Mar 30, Day 4: Tue Mar 31, Day 5: Wed Apr 1, Day 6: Thu Apr 2, Day 7: Fri Apr 3 (Departure 18:25)

Key Chengdu knowledge:
- Panda Base: Arrive 7:30-8 AM. ¥55 adult, ¥5 child. 3-4 hours.
- Happy Valley: Full day, Magic Castle zone for 5yo.
- People's Park: Free, Heming Teahouse, tai chi.
- Wuhou Shrine + Jinli Ancient Street: Adjacent, kid-friendly snacks & crafts.
- Kuanzhai Alley: Historic lanes, food stalls, performers.
- Dujiangyan: UNESCO, 1hr from city.
- Sichuan Opera face-changing: Book via hotel, magical for kids.
- Children's Museum / Dotsss: Interactive, ages 2-10.
- Peppa Pig Play Cafe at IN99: Perfect for 5yo.
- Jinsha Museum: Gold masks, interactive exhibits, ¥70 adult.
- New Century Global Center: Indoor play, water park.
- Mount Qingcheng: Cable car, beautiful scenery.

Food for kids: Yuanyang hotpot (split pot), twice-cooked pork, sweet water noodles, dumplings, mild dan dan noodles. Haidilao for families. Avoid mala for kids.
Transport: Metro excellent. DiDi works well. Airport to city ~45min metro, ~1-1.5hr taxi.

BEHAVIOR RULES:
1. Be conversational, warm, and helpful. Use short paragraphs.
2. If the user sends a photo, analyze it and provide relevant advice.
3. When you have enough context to suggest specific activities, include them as structured suggestions.
4. To embed suggestions, use this format:

<<<ACTIVITY>>>
{"title":"...","description":"...","category":"attraction|food|transport|rest|shopping","timeStart":"HH:MM","timeEnd":"HH:MM","location":"...","address":"...","notes":"...","cost":"..."}
<<<END_ACTIVITY>>>

5. You can include multiple <<<ACTIVITY>>> blocks.
6. Only include activity blocks for specific recommendations. For casual chat, respond normally.
7. Always consider the child's energy, nap times, and mild food preferences.
8. Be specific with restaurant names, ticket prices, addresses, and practical tips.`;

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, currentDay } = req.body;

  const dayLabels = ["Sat Mar 28 (Arrival)", "Sun Mar 29", "Mon Mar 30", "Tue Mar 31", "Wed Apr 1", "Thu Apr 2", "Fri Apr 3 (Departure)"];
  const dayLabel = currentDay !== undefined ? dayLabels[currentDay] || `Day ${currentDay + 1}` : "all days";

  try {
    const anthropicMessages = messages.map((msg) => {
      if (msg.role === "user" && msg.images && msg.images.length > 0) {
        const content = [];
        for (const img of msg.images) {
          const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            content.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
          }
        }
        if (msg.content) content.push({ type: "text", text: msg.content });
        return { role: "user", content };
      }
      return { role: msg.role, content: msg.content };
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: SYSTEM_PROMPT + `\n\nCurrent focus: ${dayLabel}`,
      messages: anthropicMessages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    const activities = [];
    const activityRegex = /<<<ACTIVITY>>>\s*([\s\S]*?)\s*<<<END_ACTIVITY>>>/g;
    let match;
    while ((match = activityRegex.exec(text)) !== null) {
      try { activities.push(JSON.parse(match[1])); } catch {}
    }

    const cleanText = text.replace(/<<<ACTIVITY>>>\s*[\s\S]*?\s*<<<END_ACTIVITY>>>/g, "{{ACTIVITY_CARD}}").trim();

    res.status(200).json({ text: cleanText, activities });
  } catch (e) {
    console.error("AI chat error:", e);
    res.status(500).json({ error: e.message });
  }
}
