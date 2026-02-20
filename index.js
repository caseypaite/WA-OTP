require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3050;
const apiKey = process.env.API_KEY;
const sessionId = process.env.SESSION_ID || 'wa-otp-session';

// Enable CORS
app.use(cors());

app.use(bodyParser.json({ limit: '50mb' }));

// --- Authentication Middleware ---
const authenticate = (req, res, next) => {
    const providedKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey && providedKey !== apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
};

// Apply authentication to all routes except a health check if desired
// Here we apply it to everything for security
app.use(authenticate);

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: sessionId
    }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://github.com/wppconnect-team/wa-version/blob/main/html/2.3000.1033770598-alpha.html',
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

let clientReady = false;
let webhookUrl = process.env.WEBHOOK_URL || null;

const serialize = (obj) => {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (typeof value === 'function') return undefined;
        if (key === '_client' || key === 'client') return undefined;
        return value;
    }));
};

const sendWebhook = async (event, data) => {
    if (!webhookUrl) return;
    try {
        await axios.post(webhookUrl, { event, data: serialize(data) });
    } catch (error) {
        console.error('Webhook failed:', error.message);
    }
};

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`Client [${sessionId}] is ready!`);
    clientReady = true;
    sendWebhook('ready', { timestamp: Date.now(), sessionId });
});

client.on('authenticated', () => {
    console.log(`Client [${sessionId}] AUTHENTICATED`);
    sendWebhook('authenticated', { timestamp: Date.now(), sessionId });
});

client.on('auth_failure', msg => {
    console.error(`Client [${sessionId}] AUTHENTICATION FAILURE`, msg);
    sendWebhook('auth_failure', { message: msg, sessionId });
});

client.on('disconnected', (reason) => {
    console.log(`Client [${sessionId}] was logged out`, reason);
    clientReady = false;
    sendWebhook('disconnected', { reason, sessionId });
});

client.on('message', async (message) => {
    sendWebhook('message', message);
});

client.on('message_create', (message) => {
    sendWebhook('message_create', message);
});

client.on('message_ack', (message, ack) => {
    sendWebhook('message_ack', { message, ack });
});

// Middleware to check if client is ready
const checkReady = (req, res, next) => {
    if (!clientReady) {
        return res.status(503).json({ error: 'Client is not ready yet.' });
    }
    next();
};

// --- API Endpoints ---

// Set Webhook
app.post('/webhook', (req, res) => {
    webhookUrl = req.body.url;
    res.json({ success: true, url: webhookUrl });
});

// Status Endpoint
app.get('/status', (req, res) => {
    res.json({ 
        ready: clientReady, 
        state: clientReady ? 'CONNECTED' : 'NOT_READY',
        sessionId: sessionId
    });
});

// Generic API Call
app.post('/call', checkReady, async (req, res) => {
    const { type, id, method, args } = req.body;
    let target;
    try {
        switch (type) {
            case 'client':
                target = client;
                break;
            case 'chat':
                target = await client.getChatById(id);
                break;
            case 'contact':
                target = await client.getContactById(id);
                break;
            default:
                return res.status(400).json({ error: 'Invalid type. Use client, chat, or contact.' });
        }

        if (typeof target[method] !== 'function') {
            return res.status(400).json({ error: `Method ${method} not found on ${type}.` });
        }

        const result = await target[method](...(args || []));
        res.json(serialize(result));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Specialized Endpoint: Send Message
app.post('/send-message', checkReady, async (req, res) => {
    const { chatId, content, options } = req.body;
    try {
        const message = await client.sendMessage(chatId, content, options);
        res.json(serialize(message));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Specialized Endpoint: Send Media
app.post('/send-media', checkReady, async (req, res) => {
    const { chatId, url, caption, options } = req.body;
    try {
        const media = await MessageMedia.fromUrl(url);
        const message = await client.sendMessage(chatId, media, { ...options, caption });
        res.json(serialize(message));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Specialized Endpoint: Send OTP
app.post('/send-otp', checkReady, async (req, res) => {
    const { number, otp, template } = req.body;
    if (!number || !otp) {
        return res.status(400).json({ error: 'number and otp are required.' });
    }
    const content = template ? template.replace('{{otp}}', otp) : `Your OTP is: ${otp}`;
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    try {
        const message = await client.sendMessage(chatId, content);
        res.json({ success: true, messageId: message.id.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Specialized Endpoint: Send Newsletter/Channel Message (⚠️ CURRENTLY NOT WORKING)
app.post('/send-newsletter', checkReady, async (req, res) => {
    const { newsletterId, content, options } = req.body;
    if (!newsletterId || !content) {
        return res.status(400).json({ error: 'newsletterId and content are required.' });
    }
    
    const chatId = newsletterId.includes('@newsletter') ? newsletterId : `${newsletterId}@newsletter`;
    
    try {
        // Direct call is sometimes more stable than fetching the object first
        const message = await client.sendMessage(chatId, content, {
            ...options,
            sendSeen: false // Critical for newsletters
        });
        res.json(serialize(message));
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            stack: error.stack,
            suggestion: "If 'reading add' error persists, please use /reset-session and re-authenticate."
        });
    }
});

// Endpoint to reset session (requires re-auth)
app.post('/reset-session', async (req, res) => {
    try {
        await client.logout();
        clientReady = false;
        // In a real app you might want to rm -rf the auth folder here
        res.json({ success: true, message: "Logged out. Please restart the server to scan new QR." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Specialized Endpoint: List Admin Newsletters (⚠️ CURRENTLY NOT WORKING)
app.get('/admin-newsletters', checkReady, async (req, res) => {
    try {
        const chats = await client.getChats();
        const newsletters = chats.filter(chat => 
            (chat.id.server === 'newsletter' || chat.isChannel === true || chat.id._serialized.endsWith('@newsletter'))
        ).map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            viewerRole: chat.viewerRole,
            isReadOnly: chat.isReadOnly,
            isChannel: chat.isChannel
        }));

        // Filter for admin/owner roles if they exist, otherwise return all found newsletters
        // to help debug why the list might be empty.
        const adminNewsletters = newsletters.filter(n => 
            n.viewerRole === 'ADMIN' || n.viewerRole === 'OWNER' || n.viewerRole === 'CREATOR'
        );

        res.json(adminNewsletters.length > 0 ? adminNewsletters : { 
            message: "No admin newsletters found, but here are all detected newsletters for debugging.",
            allNewsletters: newsletters 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`WA-OTP Server [${sessionId}] running on port ${port}`);
    if (apiKey) console.log('API Authentication enabled.');
});

client.initialize();
