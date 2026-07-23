const Groq = require('groq-sdk');

class GroqProvider {
  constructor() {
    this._client = null;
    this.model = 'llama3-8b-8192';
  }

  _getClient() {
    if (!this._client) {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY no configurada. Verificar variables de entorno.');
      }
      this._client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return this._client;
  }

  async complete(messages) {
    const client = this._getClient();
    const res = await client.chat.completions.create({
      model: this.model, messages, max_tokens: 500, temperature: 0.7
    });
    return {
      content:    res.choices[0]?.message?.content || '',
      tokensUsed: res.usage?.total_tokens || 0
    };
  }
}

function createLLMProvider() {
  const provider = process.env.LLM_PROVIDER || 'groq';
  if (provider === 'groq') return new GroqProvider();
  throw new Error(`LLM provider desconocido: ${provider}`);
}

module.exports = { createLLMProvider };
