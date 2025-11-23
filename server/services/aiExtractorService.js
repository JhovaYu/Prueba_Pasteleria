 */
async function getInitialExtraction(conversationText) {
    const today = new Date().toLocaleDateString('es-MX', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // ===== PROMPT ACTUALIZADO PARA DETECCIÓN Y ESTRUCTURACIÓN DE BASE/ESPECIAL =====
    const prompt = `
        Eres un asistente experto para una pastelería llamada "La Fiesta". Tu tarea es analizar la siguiente conversación de WhatsApp
        y extraer la información clave para generar un folio de pedido en formato JSON. La fecha de hoy es ${today}.

        **Instrucciones Generales:**
        1.  **Analiza la conversación:** Lee todo el texto para entender los detalles del pedido.
        2.  **Interpreta fechas y horas:** Convierte fechas relativas (ej. "mañana", "el próximo lunes") a formato AAAA-MM-DD. Convierte horas a formato HH:MM:SS de 24 horas.
        3.  **Formato de Salida:** Responde únicamente con un objeto JSON válido, sin ningún texto adicional antes o después.

        **Instrucciones Específicas para Tipo de Folio y Estructura:**
        1.  **Detecta el Tipo de Folio:**
            * Si la conversación menciona explícitamente "pisos", "bases", "pastel especial", "de base", o describe claramente diferentes secciones/pisos del pastel con distintas características (personas, panes, rellenos por sección), establece \`folioType\` como \`"Base/Especial"\`.
            * En cualquier otro caso, establece \`folioType\` como \`"Normal"\`.
        2.  **Extrae Datos según el Tipo:**
            * **Si es "Normal":**
                * Extrae los sabores generales en el array \`cakeFlavor\`. Pueden ser hasta 2.
                * Extrae los rellenos generales en el array \`filling\`. Pueden ser hasta 2.
                * Deja el campo \`tiers\` como \`null\` o un array vacío \`[]\`.
            * **Si es "Base/Especial":**
                * **Deja los campos \`cakeFlavor\` y \`filling\` como \`null\` o arrays vacíos \`[]\`**. La información irá en \`tiers\`.
                * Analiza la descripción de cada piso **ESTRUCTURAL (APILADO)** y crea un array de objetos en el campo \`tiers\`. **NO incluyas planchas o pasteles de complemento aquí.**
                * Cada objeto dentro de \`tiers\` DEBE tener la siguiente estructura exacta:
                    \`\`\`
                    {
                      "persons": number,      // Personas para ESE piso
                      "panes": [string, string, string], // Intenta extraer 3 sabores de pan para el piso. Si solo mencionan uno, repítelo 3 veces. Si mencionan dos, añade el primero de nuevo al final. Si no mencionan, usa [null, null, null].
                      "rellenos": [string, string], // Intenta extraer 2 rellenos para el piso. Si solo mencionan uno, añádelo y pon el segundo como null. Si no mencionan o no aplica (ej. pan queso), usa [null, null].
                      "notas": string | null  // Notas adicionales o forma específica del piso (opcional)
                    }
                    \`\`\`
                * Asegúrate de que \`persons\` en el nivel raíz del JSON siga siendo el número total de personas para todo el pedido (la suma de las personas de los pisos si está disponible, o el total mencionado).

        **Reglas Adicionales:**
        * **Dedicatoria:** Si encuentras frases como "que diga '...'", "con el texto '...'", o una frase entre comillas que deba ir en el pastel, extrae ese texto EXCLUSIVAMENTE en el campo \`dedication\`. NO incluyas la dedicatoria en \`designDescription\`.
        * **Dirección:** Intenta formatear como "Calle y Número, Colonia Nombre de la Colonia" en \`deliveryLocation\`. Si es "recoge en tienda", usa ese texto exacto. Si es "envía ubicación por Maps", usa "El cliente envía ubicación (Google Maps)".
        * **Valores Numéricos:** Extrae solo el número para \`deliveryCost\`, \`total\`, \`advancePayment\`. Si no se mencionan, usa \`null\`.

        **Campos a extraer (adapta según el folioType detectado):**
        - \`folioType\`: (String) "Normal" o "Base/Especial". **Obligatorio**.
        - \`clientName\`: (String | null) Nombre del cliente.
        - \`clientPhone\`: (String | null) Teléfono (si se menciona).
        - \`deliveryDate\`: (String | null) Fecha de entrega (YYYY-MM-DD).
        - \`deliveryTime\`: (String | null) Hora de entrega (HH:MM:SS).
        - \`persons\`: (Number | null) Número TOTAL de personas para el pedido completo. **Obligatorio**.
        - \`shape\`: (String | null) Forma general del pastel (ej. "Redondo", "Rectangular").
        - \`cakeFlavor\`: (Array of Strings | null) Sabores generales del pan (SOLO para tipo "Normal").
        - \`filling\`: (Array of Strings | null) Rellenos generales (SOLO para tipo "Normal").
        - \`tiers\`: (Array of Objects | null) Estructura por pisos **APILADOS** (SOLO para tipo "Base/Especial"). **NO incluir planchas aquí.** Sigue la estructura definida arriba.
        - \`designDescription\`: (String | null) Descripción detallada de la decoración (SIN dedicatoria).
        - \`dedication\`: (String | null) Texto de la dedicatoria.
        - \`deliveryLocation\`: (String | null) Dirección de entrega o "recoge en tienda".
        - \`deliveryCost\`: (Number | null) Costo del envío (solo número).
        - \`total\`: (Number | null) Costo total o del pastel (solo número).
        - \`advancePayment\`: (Number | null) Anticipo (solo número).
        - \`complements\`: (Array of Objects | null) Array de pasteles ADICIONALES (planchas, quequitos) que complementan el pedido. **NO SON LOS PISOS DEL PASTEL PRINCIPAL.** Ejemplo: Si piden "pastel de 2 pisos Y dos planchas", aquí SÓLO van las dos planchas.
            * \`\`\`
                {
                  "persons": number | null,   // Personas para ESE complemento
                  "shape": string | null,     // Forma (ej. "Plancha")
                  "flavor": string | null,    // Sabor del pan
                  "filling": string | null,   // Relleno
                  "description": string | null // Decoración o notas
                }
                \`\`\`
        - \`accessories\`: (String | null) Accesorios físicos (ej. "Oblea", "Figura de fondant", "Moño").
        - \`additional\`: (Array of Objects | null) Adicionales con costo (ej. velas, letreros). Estructura: \`[{ "name": "Cant x Producto", "price": number }]\`.
        - \`hasExtraHeight\`: (Boolean) \`true\` si el pastel principal lleva altura extra.

        **Conversación a analizar:**
        ---
        ${conversationText}
        ---
    `;

    try {
        console.log("🤖 Iniciando extracción inicial con IA...");
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
            model: "gpt-4o", // Usamos gpt-4o por su mejor capacidad para seguir instrucciones complejas y estructurar JSON
            messages: [{ role: "system", content: prompt }],
            response_format: { type: "json_object" }, // Forzar salida JSON
        });

        const extractedJsonString = response.choices[0].message.content;
        console.log("🤖 Datos extraídos por la IA (Extracción Inicial - Raw):", extractedJsonString);

        // Validación básica antes de parsear
        if (!extractedJsonString || !extractedJsonString.trim().startsWith('{') || !extractedJsonString.trim().endsWith('}')) {
            console.error("Respuesta inválida de OpenAI:", extractedJsonString);
            throw new Error("La respuesta de la IA no fue un objeto JSON válido.");
        }

        let extractedData;
        try {
            extractedData = JSON.parse(extractedJsonString);
        } catch (parseError) {
            console.error("Error al parsear JSON de OpenAI:", parseError, "JSON recibido:", extractedJsonString);
            throw new Error(`Error al interpretar la respuesta de la IA: ${parseError.message}`);
        }


        // --- Validaciones y Aseguramiento de Tipos ---
        const requiredKeys = ['folioType', 'persons', 'deliveryDate']; // Campos mínimos esperados
        for (const key of requiredKeys) {
            if (!(key in extractedData) || extractedData[key] === null || extractedData[key] === undefined) {
                console.warn(`Advertencia: La IA no extrajo el campo obligatorio '${key}'. Se intentará continuar, pero puede causar errores.`);
                // Podrías establecer un valor por defecto o lanzar un error más estricto si lo prefieres
                // extractedData[key] = null; // Ejemplo: asegurar que exista aunque sea nulo
            }
        }

        // Asegurar que 'persons' sea un número
        if (extractedData.persons && typeof extractedData.persons !== 'number') {
            const parsedPersons = parseInt(extractedData.persons, 10);
            extractedData.persons = !isNaN(parsedPersons) ? parsedPersons : null;
        }

        // Asegurar que folioType sea uno de los valores permitidos, si no, default a Normal
        if (!['Normal', 'Base/Especial'].includes(extractedData.folioType)) {
            console.warn(`folioType inválido ('${extractedData.folioType}') recibido de la IA. Se usará 'Normal' por defecto.`);
            extractedData.folioType = 'Normal';
        }

        // Limpieza condicional basada en folioType (asegurar consistencia)
        if (extractedData.folioType === 'Base/Especial') {
            extractedData.cakeFlavor = null; // O []
            extractedData.filling = null;    // O []
            if (!Array.isArray(extractedData.tiers)) {
                console.warn("folioType es Base/Especial pero 'tiers' no es un array. Se establecerá a [].");
                extractedData.tiers = [];
            }
        } else { // Si es 'Normal'
            extractedData.tiers = null; // O []
            if (!Array.isArray(extractedData.cakeFlavor)) extractedData.cakeFlavor = [];
            if (!Array.isArray(extractedData.filling)) extractedData.filling = [];
        }

        // --- INICIO CORRECCIÓN: Asegurar que los arrays existan ---
        if (!Array.isArray(extractedData.complements)) extractedData.complements = [];
        if (!Array.isArray(extractedData.additional)) extractedData.additional = [];
        // --- FIN CORRECCIÓN ---


        // Convertir campos numéricos que puedan venir como string
        ['deliveryCost', 'total', 'advancePayment'].forEach(key => {
            if (extractedData[key] && typeof extractedData[key] === 'string') {
                const num = parseFloat(extractedData[key]);
                extractedData[key] = isNaN(num) ? null : num;
            } else if (extractedData[key] === undefined) {
                extractedData[key] = null;
            }
        });

        console.log("✅ Datos extraídos y procesados:", JSON.stringify(extractedData, null, 2));
        return extractedData;

    } catch (error) {
        console.error("❌ Error en getInitialExtraction:", error);
        // Devolver un objeto de error estructurado podría ser útil para el controlador
        throw new Error(`Error durante la extracción inicial con IA: ${error.message}`);
    }
}

module.exports = { getInitialExtraction };