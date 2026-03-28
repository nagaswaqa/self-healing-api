import dotenv from 'dotenv';
dotenv.config();   // load self-healing-api/.env before anything else

import express, { Request, Response } from 'express';
import cors from 'cors';
import { DomHealingEngine } from './engines/DomHealingEngine';
import { OcrHealingEngine } from './engines/OcrHealingEngine';
import { VisualHealingEngine } from './engines/VisualHealingEngine';
import { LlmHealingEngine } from './engines/LlmHealingEngine';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
// Need high limit for large DOM structures and Base64 Screenshots
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const domEngine = new DomHealingEngine();
const ocrEngine = new OcrHealingEngine();
const visualEngine = new VisualHealingEngine();
const llmEngine = new LlmHealingEngine();

app.post('/heal', async (req: Request, res: Response): Promise<void> => {
    try {
        const { strategy, locatorName, originalSelector, html, base64Image, expectedText, templateName } = req.body;

        console.log(`[Heal API] Received ${strategy} healing request for '${locatorName}'`);

        let result: { selector: string; confidence: number } | null = null;

        if (strategy === 'dom') {
            if (!html || !originalSelector) {
                res.status(400).json({ error: "Strategy 'dom' requires 'html' and 'originalSelector'" });
                return;
            }
            result = await domEngine.heal(html, originalSelector);
        } else if (strategy === 'ocr') {
            if (!base64Image || !expectedText) {
                res.status(400).json({ error: "Strategy 'ocr' requires 'base64Image' and 'expectedText'" });
                return;
            }
            result = await ocrEngine.heal(base64Image, expectedText);
        } else if (strategy === 'visual') {
            if (!base64Image || !templateName) {
                res.status(400).json({ error: "Strategy 'visual' requires 'base64Image' and 'templateName'" });
                return;
            }
            result = await visualEngine.heal(base64Image, templateName);
        } else {
            res.status(400).json({ error: `Unknown strategy: ${strategy}` });
            return;
        }

        if (result && result.selector) {
            console.log(`[Heal API] Success: ${result.selector} (Confidence: ${result.confidence})`);
            res.status(200).json(result);
            return;
        }

        console.log(`[Heal API] Failed to heal '${locatorName}' using ${strategy}`);
        res.status(404).json({ error: "Healing failed to find a valid selector" });

    } catch (error) {
        console.error('[Heal API] Error processing request:', error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── LLM healing endpoint ──────────────────────────────────────────────────────
app.post('/heal/llm', async (req: Request, res: Response): Promise<void> => {
    try {
        const { locatorName, originalSelector, base64Image, domSnippet } = req.body;

        if (!base64Image || !domSnippet || !locatorName || !originalSelector) {
            res.status(400).json({
                error: "Required fields: locatorName, originalSelector, base64Image, domSnippet"
            });
            return;
        }

        console.log(`[LLM Heal API] Request for '${locatorName}' (broken: ${originalSelector})`);

        const result = await llmEngine.heal(base64Image, domSnippet, locatorName, originalSelector);

        if (result && result.selector) {
            console.log(`[LLM Heal API] Success: ${result.selector} (confidence: ${result.confidence})`);
            res.status(200).json(result);
            return;
        }

        console.log(`[LLM Heal API] LLM could not find selector for '${locatorName}'`);
        res.status(404).json({ error: 'LLM could not find a valid selector' });

    } catch (error) {
        console.error('[LLM Heal API] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Self-Healing API running on http://localhost:${PORT}`);
});
