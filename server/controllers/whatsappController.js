try {
  const messageData = req.body.data;

  // 1. Verificamos si el cuerpo del mensaje contiene nuestro comando de activación.
  if (!messageData || !messageData.body || !messageData.body.trim().toLowerCase().includes(TRIGGER_COMMAND)) {
    console.log("Webhook recibido, pero no es un comando de activación. Ignorando.");
    return res.status(200).send('EVENT_RECEIVED_BUT_IGNORED');
  }

  console.log(`✅ Comando '${TRIGGER_COMMAND}' detectado. Iniciando nueva sesión de IA...`);
  const conversationText = messageData.conversation;

  // 2. Enviamos la conversación a nuestro servicio de IA para que la analice.
  const extractedData = await getInitialExtraction(conversationText);
  console.log("🤖 Datos extraídos por la IA:", JSON.stringify(extractedData, null, 2));

  // 3. Validamos los datos mínimos (la IA debería proporcionarlos).
  if (!extractedData.clientName || !extractedData.deliveryDate || !extractedData.persons) {
    throw new Error("La IA no pudo extraer los datos mínimos requeridos (nombre, fecha o personas).");
  }

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