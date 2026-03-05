import { JSDOM } from 'jsdom';

export class DomHealingEngine {
    /**
     * Attempts to heal a broken locator using DOM heuristics.
     * @param html - Full HTML string of the page
     * @param originalSelector - The broken selector
     * @returns A healed selector and confidence score, or null
     */
    public async heal(html: string, originalSelector: string): Promise<{ selector: string; confidence: number } | null> {
        try {
            const dom = new JSDOM(html);
            const document = dom.window.document;

            // Strategy 1: ID Match
            const idMatch = originalSelector.match(/#([\w-]+)/);
            if (idMatch) {
                const id = idMatch[1];
                if (document.getElementById(id)) {
                    return { selector: `#${id}`, confidence: 0.95 };
                }
            }

            // Strategy 2: Class Names Match
            const classMatches = originalSelector.match(/\.([\w-]+)/g);
            if (classMatches && classMatches.length > 0) {
                const classSelector = classMatches.join('');
                if (document.querySelector(classSelector)) {
                    return { selector: classSelector, confidence: 0.85 };
                }
            }

            // Strategy 3: Text Content
            const textMatch = originalSelector.match(/text[\s]*=[\s]*["']([^"']+)["']/i);
            if (textMatch) {
                const text = textMatch[1];
                // basic text search for jsdom
                const elements = Array.from(document.body.querySelectorAll('*'));
                const hasText = elements.some(el => {
                    // Check if the element contains the exact text directly
                    return el.textContent && el.textContent.trim() === text.trim() && el.children.length === 0;
                });
                if (hasText) {
                    return { selector: `text="${text}"`, confidence: 0.80 };
                }
            }

            // Strategy 4: Tag + Attributes
            const tagMatch = originalSelector.match(/^([a-z]+)/i);
            if (tagMatch) {
                const tag = tagMatch[1];
                const attrMatches = originalSelector.match(/\[([^\]=]+)\s*=\s*["']([^"']*)["']\]/g);
                if (attrMatches && attrMatches.length > 0) {
                    for (const attrMatch of attrMatches) {
                        const cleanAttr = attrMatch.replace(/[\[\]"']/g, '');
                        const [attr, value] = cleanAttr.split('=');
                        const newSelector = `${tag}[${attr}="${value.trim()}"]`;
                        if (document.querySelector(newSelector)) {
                            return { selector: newSelector, confidence: 0.75 };
                        }
                    }
                }
            }

            // Strategy 5: XPath Fallback
            return this.performXPathHeal(document, originalSelector);

        } catch (error) {
            console.error('[DOM Healing Engine] Error parsing DOM:', error);
            return null;
        }
    }

    private performXPathHeal(document: Document, originalSelector: string): { selector: string; confidence: number } | null {
        try {
            const xpath = originalSelector.startsWith('/') ? originalSelector : `//body//${originalSelector}`;
            // 9 is the value for FIRST_ORDERED_NODE_TYPE in XPathResult
            const result = document.evaluate(
                xpath,
                document,
                null,
                9,
                null
            );
            const element = result.singleNodeValue as HTMLElement;

            if (element) {
                if (element.id) {
                    return { selector: `#${element.id}`, confidence: 0.9 };
                }
                if (element.className) {
                    const classes = (element.className as string).split(' ').filter(Boolean);
                    if (classes.length > 0) {
                        return { selector: `.${classes.join('.')}`, confidence: 0.75 };
                    }
                }
                const role = element.getAttribute('role');
                const type = element.getAttribute('type');
                if (role) {
                    return { selector: `[role="${role}"]`, confidence: 0.70 };
                }
                if (type) {
                    return {
                        selector: `${element.tagName.toLowerCase()}[type="${type}"]`,
                        confidence: 0.70
                    };
                }
            }
        } catch (error) {
            // expected if xpath is malformed
        }
        return null;
    }
}
