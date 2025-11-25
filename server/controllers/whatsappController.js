const axios = require('axios');

// El comando que el empleado usará en WhatsApp para activar la IA
const TRIGGER_COMMAND = 'generar folio de su pedido';

/**
 * Maneja los webhooks de WhatsApp. Si detecta el comando de activación,
 * extrae los datos de la conversación con IA y crea una SESIÓN DE CHAT.
 */
exports.handleWebhook = async (req, res) => {
  try {
    const messageData = req.body.data || req.body; // Adaptable a diferentes estructuras de webhook

    // Validar que exista el cuerpo del mensaje
    const bodyText = messageData.body || (messageData.message && messageData.message.body);

    if (!bodyText || !bodyText.trim().toLowerCase().includes(TRIGGER_COMMAND)) {
      console.log("Webhook recibido, pero no es un comando de activación. Ignorando.");
      return res.status(200).send('EVENT_RECEIVED_BUT_IGNORED');
    }

    console.log(`✅ Comando '${TRIGGER_COMMAND}' detectado. Iniciando nueva sesión de IA...`);

    let conversationText = messageData.conversation;

    // --- NUEVO: Si no viene la conversación, la buscamos en la API de Whaticket ---
    if (!conversationText) {
      console.log("⚠️ El webhook no incluye historial. Buscando en API de Whaticket...");

      const contactId = messageData.contactId || (messageData.key && messageData.key.remoteJid) || messageData.from;

      if (contactId && process.env.WHATICKET_API_URL && process.env.WHATICKET_API_TOKEN) {
        try {
          // Ejemplo de llamada a API Whaticket (ajustar endpoint según documentación real)
          // GET /messages?contactId=...&limit=20
          const apiUrl = `${process.env.WHATICKET_API_URL}/messages`;
          const response = await axios.get(apiUrl, {
            params: {
              contactId: contactId,
              limit: 20
            },
            headers: { 'Authorization': `Bearer ${process.env.WHATICKET_API_TOKEN}` }
          });

          const messages = response.data.messages || response.data; // Ajustar según respuesta real
          if (Array.isArray(messages)) {
            conversationText = messages.reverse().map(m => {
              const sender = m.fromMe ? "Empleado" : "Cliente";
              return `${sender}: ${m.body}`;
            }).join('\n');
            console.log("✅ Historial recuperado de Whaticket API.");
          }
        } catch (apiError) {
          console.error("❌ Error al consultar API de Whaticket:", apiError.message);
          // Continuamos, tal vez la IA pueda hacer algo solo con el último mensaje (aunque improbable)
        }
      } else {
        console.warn("⚠️ No se puede buscar historial: Faltan credenciales de API o ID de contacto.");
      }
    }

    // Si aún no hay conversación, usamos al menos el mensaje actual para que no falle
    if (!conversationText) {
      conversationText = `Empleado: ${bodyText}`;
    }

    // 2. Enviamos la conversación a nuestro servicio de IA para que la analice.
    const extractedData = await getInitialExtraction(conversationText);
    console.log("🤖 Datos extraídos por la IA:", JSON.stringify(extractedData, null, 2));

    // 3. Validamos los datos mínimos (la IA debería proporcionarlos).
    // if (!extractedData.clientName || !extractedData.deliveryDate || !extractedData.persons) {
    //   throw new Error("La IA no pudo extraer los datos mínimos requeridos (nombre, fecha o personas).");
    // }

    // NOTA: La lógica para descargar imágenes se añadirá aquí en el futuro.
    // Por ahora, simulamos que no se encontraron imágenes.
    const imageUrls = [];

    // 4. Creamos la nueva sesión de chat en la base de datos.
    const newSession = await AISession.create({
      whatsappConversation: conversationText,
      extractedData: extractedData, // Guardamos el JSON completo extraído por la IA
      imageUrls: imageUrls,
      chatHistory: [], // El historial de chat con el empleado empieza vacío
      status: 'active'
    });

    console.log(`✅ Nueva sesión de IA #${newSession.id} creada exitosamente.`);

    res.status(200).send('AI_SESSION_CREATED');

  } catch (error) {
    console.error("❌ Error procesando el webhook para crear sesión de IA:", error.message);
    res.status(500).send('ERROR_PROCESSING_WEBHOOK');
  }
};