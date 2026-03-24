import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { dayIndex, existingItems, prompt } = req.body;
  const dayLabels = ["Day 1 - Sat Mar 28 (Arrival)", "Day 2 - Sun Mar 29", "Day 3 - Mon Mar 30", "Day 4 - Tue Mar 31", "Day 5 - Wed Apr 1", "Day 6 - Thu Apr 2", "Day 7 - Fri Apr 3 (Departure)"];

  const system = `You are a Chengdu travel expert helping a family from Singapore (2 adults + 1 child aged 5).
Trip: March 28 - April 3, 2026. Hotel: Lyhn International Hotel Taikoo Li.
Return ONLY a JSON array of 2-4 activities. Each: { "title","description","category":"attraction|food|transport|rest|shopping","timeStart":"HH:MM","timeEnd":"HH:MM","location","address","notes","cost" }
Consider child energy levels, mild food, travel time between locations.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: prompt || `Suggest activities for ${dayLabels[dayIndex] || `Day ${dayIndex + 1}`}. Existing: ${JSON.stringify(existingItems || [])}` }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      res.status(200).json(JSON.parse(jsonMatch[0]));
    } else {
      res.status(500).json({ error: "Could not parse AI response" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
