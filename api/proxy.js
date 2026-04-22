// Vercel Serverless Function: Ultimate AI Proxy (Banana Edition)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { model, prompt, apiKey } = req.body;

    try {
        // --- GROK ENGINE ---
        if (model === 'grok') {
            const response = await fetch('https://api.x.ai/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "grok-2-vision-1212",
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024"
                })
            });
            const data = await response.json();
            if (!response.ok) return res.status(response.status).json({ error: 'Grok Error', details: JSON.stringify(data) });
            return res.status(200).json(data);
        }

        // --- GEMINI ENGINE (BANANA PRO DISCOVERY) ---
        if (model === 'gemini') {
            // 1. List ALL models to find "Nano Banana" and other experimental ones
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const listRes = await fetch(listUrl);
            const listData = await listRes.json();

            if (!listRes.ok || !listData.models) {
                return res.status(listRes.status || 500).json({ 
                    error: 'Failed to list models', 
                    details: JSON.stringify(listData) 
                });
            }

            // 2. Comprehensive Filter: Find models that support 'predict' or 'generateImages'
            const creativeModels = listData.models.filter(m => {
                const methods = m.supportedGenerationMethods || m.supported_methods || [];
                return methods.includes('predict') || methods.includes('generateImages');
            });

            // 3. Smart Sorting (Priority: Banana Pro > Banana 2 > 4.0 > 3.1)
            creativeModels.sort((a, b) => {
                const priority = (name) => {
                    const n = name.toLowerCase();
                    if (n.includes('pro')) return 100;
                    if (n.includes('banana')) return 90;
                    if (n.includes('4.0')) return 80;
                    if (n.includes('3.1')) return 70;
                    if (n.includes('3.0')) return 60;
                    return 0;
                };
                return priority(b.name) - priority(a.name);
            });

            if (creativeModels.length === 0) {
                return res.status(404).json({ 
                    error: 'No Creative Models found!', 
                    details: 'Models found in your key: ' + listData.models.map(m => m.name.replace('models/', '')).join(', ')
                });
            }

            // 4. Try all found models
            let attempts = [];
            for (const mInfo of creativeModels) {
                const modelId = mInfo.name.replace('models/', '');
                const methods = mInfo.supportedGenerationMethods || mInfo.supported_methods || [];
                const method = methods.includes('predict') ? 'predict' : 'generateImages';

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}`;
                const body = method === 'predict' 
                    ? { instances: [{ prompt }], parameters: { sampleCount: 1 } }
                    : { prompt, numberOfImages: 1 };

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        let b64 = null;
                        if (data.predictions && data.predictions[0]) {
                            b64 = data.predictions[0].bytesBase64Encoded || (data.predictions[0].image ? data.predictions[0].image.bytesBase64Encoded : null);
                        } else if (data.images && data.images[0]) {
                            b64 = data.images[0].base64 || data.images[0].bytesBase64Encoded;
                        }

                        if (b64) return res.status(200).json({ base64: b64, modelUsed: modelId });
                    }
                    
                    const rawError = await response.text();
                    attempts.push(`${modelId}: ${response.status} (${rawError.substring(0, 100)}...)`);
                    
                    // If it's 429, don't stop, try next model!
                } catch (e) {
                    attempts.push(`${modelId}: Crash (${e.message})`);
                }
            }

            return res.status(500).json({
                error: 'All creative models in your key are currently at quota limit.',
                details: "SEARCH LOG:\n" + attempts.join("\n"),
                foundModels: creativeModels.map(m => m.name.replace('models/', '')).join(', ')
            });
        }

        return res.status(400).json({ error: 'Unsupported engine' });

    } catch (error) {
        return res.status(500).json({ error: 'Proxy Internal Crash', details: error.message });
    }
}
