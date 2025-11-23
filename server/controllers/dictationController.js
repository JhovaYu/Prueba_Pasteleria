const OpenAI = require('openai');
const { getInitialExtraction } = require('../services/aiExtractorService');
const fs = require('fs'); // Necesario para Whisper si se usa createReadStream
const os = require('os');
const path = require('path');


// Carga la clave API desde .env (asegúrate que esté configurado)
let openai;

function getOpenAIClient() {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set in environment variables.');
        }
        openai = new OpenAI();
    }
    return openai;
}

exports.processDictation = async (req, res) => {
    console.log("🎤 Recibida solicitud para procesar dictado...");

    if (!req.file) {
        return res.status(400).json({ message: 'No se recibió ningún archivo de audio.' });
    }

    try {
        // === 1. Transcribir Audio con Whisper ===
        console.log("Transcribiendo audio con Whisper...");

        // Crear un archivo temporal para enviar a Whisper
        // NOTA: OpenAI SDK v4+ ahora puede aceptar Buffers directamente o streams,
        // pero crear un archivo temporal es a veces más robusto.
        const tempFilePath = path.join(os.tmpdir(), `dictation-${Date.now()}.webm`);
        await fs.promises.writeFile(tempFilePath, req.file.buffer);

        const client = getOpenAIClient();
        const transcription = await client.audio.transcriptions.create({
            model: "whisper-1",
            file: fs.createReadStream(tempFilePath), // Enviar como stream
            // language: "es" // Puedes especificar el idioma si siempre será español
        });

        // Eliminar archivo temporal después de usarlo
        try {
            await fs.promises.unlink(tempFilePath);
        } catch (unlinkErr) {
            console.warn("No se pudo eliminar el archivo de audio temporal:", unlinkErr.message);
        }


        const transcribedText = transcription.text;
        console.log("Texto Transcrito:", transcribedText);

        if (!transcribedText || transcribedText.trim() === '') {
            throw new Error("La transcripción no produjo texto.");
        }

        // === 2. Extraer Datos con el Servicio Existente ===
        console.log("Extrayendo datos del texto transcrito...");
        // Usamos el servicio existente que ya tiene el prompt adecuado
        const extractedData = await getInitialExtraction(transcribedText);

        // === 3. Enviar Respuesta al Frontend ===
        res.status(200).json(extractedData);

    } catch (error) {
        console.error("❌ Error procesando el dictado:", error);
        // Intentar eliminar el archivo temporal también en caso de error
        if (fs.existsSync(tempFilePath)) {
            try { await fs.promises.unlink(tempFilePath); } catch (e) { }
        }
        res.status(500).json({
            message: error.message || 'Error interno al procesar el audio.',
            // Incluir detalles del error de OpenAI si están disponibles
            ...(error.response ? { apiError: error.response.data } : {})
        });
    }
};