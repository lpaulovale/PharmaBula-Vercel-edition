const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getSessionsCollection } = require("../lib/db");

const SYSTEM_PROMPT_PATIENT = `Você é o PharmaBula, um assistente inteligente especializado em informações sobre medicamentos brasileiros.

MODO PACIENTE: Use linguagem simples e acessível. Evite termos técnicos complexos. Explique como se estivesse falando com um paciente comum.

Diretrizes:
- Responda SEMPRE em português do Brasil
- Forneça informações baseadas em bulas de medicamentos registrados na ANVISA
- Inclua indicações, contraindicações, efeitos colaterais e posologia quando relevante
- SEMPRE inclua um aviso para consultar um profissional de saúde
- Nunca recomende automedicação
- Se não souber algo com certeza, diga claramente
- Formate a resposta de forma clara com parágrafos e listas quando apropriado

Responda em texto plano formatado (sem JSON). Use quebras de linha e bullet points para organizar.`;

const SYSTEM_PROMPT_PROFESSIONAL = `Você é o PharmaBula, um assistente inteligente especializado em informações farmacêuticas e clínicas sobre medicamentos brasileiros.

MODO PROFISSIONAL: Use terminologia técnica e detalhada. Inclua nomes de princípios ativos, mecanismos de ação, farmacocinética e referências a protocolos clínicos quando aplicável.

Diretrizes:
- Responda SEMPRE em português do Brasil
- Forneça informações detalhadas baseadas em bulas e literatura farmacêutica
- Inclua mecanismos de ação, farmacocinética, interações medicamentosas
- Cite classes terapêuticas e classificação ATC quando relevante
- Mencione protocolos clínicos do SUS (PCDT) quando aplicável
- Use nomenclatura DCB/DCI para princípios ativos
- Formate a resposta de forma clara e técnica

Responda em texto plano formatado (sem JSON). Use quebras de linha e bullet points para organizar.`;

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ detail: "Method not allowed" });
    }

    const { message, mode, sessionId } = req.body || {};

    if (!message || message.length < 2) {
        return res.status(400).json({ detail: "A mensagem deve ter pelo menos 2 caracteres." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ detail: "GEMINI_API_KEY não configurada no servidor." });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const systemPrompt = mode === "professional" ? SYSTEM_PROMPT_PROFESSIONAL : SYSTEM_PROMPT_PATIENT;

        // Load conversation history from MongoDB if available
        let history = [];
        const sessions = await getSessionsCollection();

        if (sessions && sessionId) {
            const session = await sessions.findOne({ sessionId });
            if (session && session.messages) {
                // Convert stored messages to Gemini chat history format
                history = session.messages.map((m) => ({
                    role: m.role,
                    parts: [{ text: m.text }],
                }));
            }
        }

        const chat = model.startChat({
            history,
            systemInstruction: systemPrompt,
        });

        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        // Save the exchange to MongoDB
        if (sessions && sessionId) {
            const newMessages = [
                { role: "user", text: message, timestamp: new Date() },
                { role: "model", text: responseText, timestamp: new Date() },
            ];

            await sessions.updateOne(
                { sessionId },
                {
                    $push: { messages: { $each: newMessages } },
                    $set: { lastActive: new Date(), mode: mode || "patient" },
                    $setOnInsert: { createdAt: new Date() },
                },
                { upsert: true }
            );
        }

        return res.status(200).json({
            response: responseText,
            mode: mode || "patient",
            framework: "gemini",
            sources: [],
            source_files: [],
            metadata: {},
        });
    } catch (error) {
        console.error("Gemini API error:", error);
        return res.status(500).json({
            detail: `Erro ao processar sua mensagem: ${error.message}`,
        });
    }
};
