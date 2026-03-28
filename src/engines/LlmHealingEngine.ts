/**
 * LlmHealingEngine - Uses OpenAI Vision (GPT-4o) to analyze a broken selector.
 * Receives a page screenshot and DOM snippet, returns the best CSS selector.
 */
export class LlmHealingEngine {
    private apiKey: string;
    private model: string;

    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || '';
        this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    }

    /**
     * Ask the LLM to find a valid CSS selector for the broken element.
     * @param base64Image  - PNG screenshot as base64 string (no data-URI prefix)
     * @param domSnippet   - Truncated HTML of the page body (≤ 8000 chars)
     * @param locatorName  - Logical name of the element (e.g. "loginButton")
     * @param brokenSelector - The selector that no longer works
     */
    public async heal(
        base64Image: string,
        domSnippet: string,
        locatorName: string,
        brokenSelector: string
    ): Promise<{ selector: string; confidence: number } | null> {
        if (!this.apiKey) {
            console.warn('[LLM Healing] OPENAI_API_KEY is not set. Skipping LLM strategy.');
            return null;
        }

        const prompt = this.buildPrompt(locatorName, brokenSelector, domSnippet);

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 300,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: prompt
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:image/png;base64,${base64Image}`,
                                        detail: 'low'   // low = cheaper + faster for UI tasks
                                    }
                                }
                            ]
                        }
                    ]
                })
            });

            if (!response.ok) {
                const err = await response.text();
                console.error(`[LLM Healing] OpenAI API error ${response.status}: ${err}`);
                return null;
            }

            const json = await response.json() as any;
            const content: string = json?.choices?.[0]?.message?.content?.trim() || '';
            console.log(`[LLM Healing] Raw response: ${content}`);

            return this.parseResponse(content);

        } catch (error) {
            console.error('[LLM Healing] Network error calling OpenAI:', error);
            return null;
        }
    }

    // ─── private helpers ────────────────────────────────────────────────────────

    private buildPrompt(locatorName: string, brokenSelector: string, domSnippet: string): string {
        return `You are a Playwright test-automation expert.
A CSS selector has broken and must be repaired.

Element logical name : "${locatorName}"
Broken selector      : "${brokenSelector}"

Page DOM snippet (may be truncated):
\`\`\`html
${domSnippet.slice(0, 8000)}
\`\`\`

Look at the screenshot and the DOM above.
Find the BEST CSS selector for the element named "${locatorName}".

Rules:
- Prefer stable attributes: id, data-testid, aria-label, name, type, role
- Avoid generated class names (e.g. "css-a3f8x")
- Return ONLY a JSON object — no markdown, no explanation
- Format: {"selector":"<css-selector>","confidence":<0.0-1.0>}
- If you cannot find the element, return: {"selector":null,"confidence":0}`;
    }

    private parseResponse(content: string): { selector: string; confidence: number } | null {
        try {
            // strip any accidental markdown fences
            const cleaned = content.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            if (!parsed.selector) {
                console.warn('[LLM Healing] LLM returned null selector — element not found.');
                return null;
            }

            return {
                selector: String(parsed.selector),
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7
            };
        } catch (e) {
            console.warn('[LLM Healing] Failed to parse LLM JSON response:', content);
            return null;
        }
    }
}
