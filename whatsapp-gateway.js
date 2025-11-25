const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// --- CONFIGURACIÓN ---
const WEBHOOK_URL = 'https://prueba-pasteleria.fly.dev/api/webhooks/whatsapp';
const TRIGGER_COMMAND = 'generar folio de su pedido'; // Para filtrar y no enviar TODO si no quieres

console.log('🚀 Iniciando Mini-Gateway de WhatsApp...');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('📸 Escanea este código QR con tu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Cliente de WhatsApp conectado y listo!');
    console.log(`📡 Reenviando mensajes a: ${WEBHOOK_URL}`);
});

client.on('message', async (msg) => {
    // Solo procesamos mensajes de texto por ahora
    if (msg.type !== 'chat') return;

    // Opcional: Filtrar para solo enviar si contiene el comando (ahorra peticiones)
    // Si quieres enviar TODO para que la IA decida, comenta estas líneas.
    // if (!msg.body.toLowerCase().includes(TRIGGER_COMMAND)) {
    //     return; 
    // }

    console.log(`📩 Mensaje recibido de ${msg.from}: ${msg.body.substring(0, 50)}...`);

    try {
        // Obtenemos el chat para sacar el historial si es necesario
        const chat = await msg.getChat();

        // Preparamos el payload compatible con lo que espera tu servidor
        // Nota: Adaptamos la estructura para que coincida con lo que espera whatsappController.js
        const payload = {
            data: {
                body: msg.body,
                from: msg.from,
                conversation: `Cliente: ${msg.body}`, // Simplificado, idealmente enviaríamos historial
                contactId: msg.from,
                key: { remoteJid: msg.from }
            }
        };

        // Si quieres enviar historial real (últimos 10 mensajes)
        // Descomenta esto para hacerlo más pro:
        /*
        const messages = await chat.fetchMessages({ limit: 10 });
        const history = messages.map(m => {
            const sender = m.fromMe ? 'Empleado' : 'Cliente';
            return `${sender}: ${m.body}`;
        }).join('\n');
        payload.data.conversation = history;
        */

        console.log('📤 Enviando a Fly.io...');
        await axios.post(WEBHOOK_URL, payload);
        console.log('✅ Enviado con éxito.');

    } catch (error) {
        console.error('❌ Error al reenviar webhook:', error.message);
        if (error.response) {
            console.error('   Respuesta del servidor:', error.response.status, error.response.data);
        }
    }
});

client.initialize();
