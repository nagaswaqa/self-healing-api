import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

export class VisualHealingEngine {
    private templatesPath: string;

    constructor() {
        this.templatesPath = path.resolve(__dirname, '../../templates');
        if (!fs.existsSync(this.templatesPath)) {
            fs.mkdirSync(this.templatesPath, { recursive: true });
        }
    }

    /**
     * Finds a matching template within the given Base64 screenshot.
     */
    public async heal(base64Image: string, templateName: string): Promise<{ selector: string; confidence: number } | null> {
        const imagePath = path.resolve(__dirname, `../../temp-visual-${Date.now()}.png`);

        try {
            // Write base64 string to temporary file for Jimp
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(imagePath, buffer);

            const templateFile = path.resolve(this.templatesPath, `${templateName}.png`);
            if (!fs.existsSync(templateFile)) {
                console.error(`[Visual Engine] Template ${templateName} not found at ${templateFile}`);
                return null;
            }

            console.log(`[Visual Engine] Searching for template: ${templateName}`);
            const matchResult = await this.matchTemplateWithJimp(imagePath, templateFile);

            if (matchResult && matchResult.confidence >= 0.6) {
                console.log(`[Visual Engine] best match score: ${matchResult.confidence}`);
                // Since this API only orchestrates, it just returns a generic bounding-box selector or instructs Playwright
                return { selector: `xpath=//body/*[position()]`, confidence: matchResult.confidence };
            }

            return null;
        } catch (error: any) {
            console.error(`[Visual Engine] Visual healing failed: ${error}`);
            return null;
        } finally {
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
    }

    private async matchTemplateWithJimp(screenshotPath: string, templatePath: string) {
        const screenshot = await Jimp.read(screenshotPath);
        const template = await Jimp.read(templatePath);

        let bestScore = 0;
        let bestCoords = { x: 0, y: 0 };

        const sW = screenshot.bitmap.width;
        const sH = screenshot.bitmap.height;
        const tW = template.bitmap.width;
        const tH = template.bitmap.height;

        for (let y = 0; y <= sH - tH; y += 10) {
            for (let x = 0; x <= sW - tW; x += 10) {
                let diff = 0;
                for (let ty = 0; ty < tH; ty += 5) {
                    for (let tx = 0; tx < tW; tx += 5) {
                        const sIdx = screenshot.getPixelIndex(x + tx, y + ty);
                        const tIdx = template.getPixelIndex(tx, ty);
                        const sr = screenshot.bitmap.data[sIdx + 0];
                        const sg = screenshot.bitmap.data[sIdx + 1];
                        const sb = screenshot.bitmap.data[sIdx + 2];
                        const tr = template.bitmap.data[tIdx + 0];
                        const tg = template.bitmap.data[tIdx + 1];
                        const tb = template.bitmap.data[tIdx + 2];
                        diff += Math.abs(sr - tr) + Math.abs(sg - tg) + Math.abs(sb - tb);
                    }
                }
                const score = 1 - diff / (tW * tH * 765);
                if (score > bestScore) {
                    bestScore = score;
                    bestCoords = { x, y };
                }
            }
        }

        return {
            confidence: bestScore,
            x: bestCoords.x,
            y: bestCoords.y,
            width: tW,
            height: tH
        };
    }
}
