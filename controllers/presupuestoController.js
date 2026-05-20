const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

exports.analizarPresupuesto = async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ error: 'No se recibió imagen.' });

        const chatCompletion = await groq.chat.completions.create({
            model: "llama-3.2-11b-vision-preview",
            messages: [{
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Analizá esta imagen de una obra o reparación en Argentina. Identificá los materiales necesarios y estimá cantidades. Respondé SOLO en JSON: { \"materiales\": [{ \"nombre\": \"string\", \"cantidad\": \"string\" }], \"tipoTrabajo\": \"string\", \"complejidad\": \"baja|media|alta\" }"
                    },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                ]
            }],
            temperature: 0.2,
            response_format: { type: "json_object" }
        });

        const info = JSON.parse(chatCompletion.choices[0].message.content);
        const manoObra = { baja: 80000, media: 180000, alta: 350000 };
        const costoManoObra = manoObra[info.complejidad] || 150000;
        const desglose = info.materiales.map(m => ({ item: m.nombre, cantidad: m.cantidad, costoEstimadoARS: 0 }));

        res.json({ success: true, tipoTrabajo: info.tipoTrabajo, complejidad: info.complejidad, manoObra: costoManoObra, materialesDesglose: desglose, totalARS: costoManoObra, nota: "Precios de materiales pendientes de API Mercado Libre" });

    } catch (error) {
        console.error('[ALADÍN-VISION]', error);
        res.status(500).json({ error: 'Error al procesar presupuesto.' });
    }
};
