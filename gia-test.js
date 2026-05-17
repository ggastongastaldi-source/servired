const fs = require('fs');
require('dotenv').config();

async function probarGIA() {
  console.log("🧠 Iniciando prueba del GIA...");
  
  const apiKey = process.env.GROQ_API_KEY; 
  if (!apiKey) {
    console.error("❌ No se encontró GROQ_API_KEY en .env");
    return;
  }
  
  console.log("✅ API Key detectada.");
  console.log("🤖 Enviando ping a Groq...");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "Responde solo con: GIA Activo en La Matanza" }]
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      console.log("\n💬 Respuesta:", data.choices[0].message.content);
    } else {
      console.log("⚠️ Respuesta inesperada:", JSON.stringify(data));
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

probarGIA();
