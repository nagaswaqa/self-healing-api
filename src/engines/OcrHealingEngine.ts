import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

export class OcrHealingEngine {
    constructor() { }

    /**
     * Finds an element by performing OCR on a base64 image.
     * Note: In a full implementation, you would map text coordinates to DOM elements.
     * We return a text selector based on the recognized text.
     */
    public async heal(base64Image: string, expectedText: string): Promise<{ selector: string; confidence: number } | null> {
        const imagePath = path.resolve(__dirname, `../../temp-ocr-${Date.now()}.png`);

        try {
            // Write base64 string to temporary file for Tesseract
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(imagePath, buffer);

            const worker = await createWorker('eng');

            console.log(`[OCR Engine] Searching for text: "${expectedText}"`);
            const { data: { text, confidence } } = await worker.recognize(imagePath);
            console.log(`[OCR Engine] Recognized text confidence: ${confidence}`);

            await worker.terminate();

            // If OCR text contains our target and has reasonable confidence
            if (text.toLowerCase().includes(expectedText.toLowerCase()) && confidence >= 30) {
                console.log(`[OCR Engine] Match found. Returning text selector.`);
                // Since this API has no direct access to the DOM coordinate mapping in this simple version,
                // it tells the client to fallback to a text selector.
                return { selector: `text=${expectedText}`, confidence: 0.7 };
            }

            return null;
        } catch (error) {
            console.error(`[OCR Engine] error:`, error);
            return null;
        } finally {
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
    }
}
