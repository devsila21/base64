const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Store active sessions
const activeSessions = new Map();

// Create sessions directory
const sessionsDir = path.join(__dirname, 'sessions');
fs.ensureDirSync(sessionsDir);

// ============================================
// 🌙 ROUTES
// ============================================

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// QR Code page
app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr.html'));
});

// Pairing page
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// Generate QR Code session
app.post('/api/qr-session', async (req, res) => {
    const sessionId = crypto.randomBytes(8).toString('hex');
    const sessionPath = path.join(sessionsDir, sessionId);
    
    fs.ensureDirSync(sessionPath);
    
    let qrCode = null;
    let sessionBase64 = null;
    let timeoutId = null;
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('NOCTURNAL-MD'),
        auth: state,
        getMessage: async () => undefined
    });
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCode = await QRCode.toDataURL(qr);
            console.log(`QR generated for session ${sessionId}`);
        }
        
        if (connection === 'open') {
            console.log(`Session ${sessionId} connected!`);
            
            // Wait for creds to save
            setTimeout(async () => {
                try {
                    const credsPath = path.join(sessionPath, 'creds.json');
                    if (fs.existsSync(credsPath)) {
                        const credsData = fs.readFileSync(credsPath, 'utf8');
                        sessionBase64 = Buffer.from(credsData).toString('base64');
                        
                        // Send session to user's inbox
                        const userJid = sock.user.id;
                        const sessionMessage = `🌙 *NOCTURNAL MD - SESSION READY*\n\n━━━━━━━━━━━━━━━━━━━━\n\n*Your Session Base64:*\n\`\`\`${sessionBase64}\`\`\`\n\n━━━━━━━━━━━━━━━━━━━━\n\n*How to use:*\n1. Copy the session above\n2. Paste in your set.js file\n3. Deploy your bot!\n\n> © ♱ NOCTURNAL ♱ | SILA`;
                        
                        await sock.sendMessage(userJid, { text: sessionMessage });
                        
                        activeSessions.set(sessionId, { sock, sessionBase64, status: 'ready' });
                    }
                } catch (e) {
                    console.error('Error saving session:', e);
                }
            }, 2000);
            
            if (timeoutId) clearTimeout(timeoutId);
            res.json({ success: true, sessionId, status: 'connected' });
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut) {
                console.log(`Session ${sessionId} logged out`);
                activeSessions.delete(sessionId);
            }
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // Send QR to client
    const checkQR = setInterval(async () => {
        if (qrCode) {
            clearInterval(checkQR);
            res.json({ success: true, sessionId, qr: qrCode, status: 'qr_ready' });
            
            // Set timeout to close session after 2 minutes if not connected
            timeoutId = setTimeout(() => {
                if (activeSessions.has(sessionId) && activeSessions.get(sessionId).status !== 'ready') {
                    console.log(`Session ${sessionId} expired`);
                    sock.end();
                    activeSessions.delete(sessionId);
                }
            }, 120000);
        }
    }, 1000);
    
    activeSessions.set(sessionId, { sock, status: 'pending' });
});

// Generate Pairing Code session
app.post('/api/pair-session', async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }
    
    // Clean phone number
    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanNumber.startsWith('255') && !cleanNumber.startsWith('1')) {
        cleanNumber = '255' + cleanNumber;
    }
    
    const sessionId = crypto.randomBytes(8).toString('hex');
    const sessionPath = path.join(sessionsDir, sessionId);
    
    fs.ensureDirSync(sessionPath);
    
    let pairingCode = null;
    let sessionBase64 = null;
    let timeoutId = null;
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('NOCTURNAL-MD'),
        auth: state,
        getMessage: async () => undefined
    });
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log(`Session ${sessionId} connected!`);
            
            setTimeout(async () => {
                try {
                    const credsPath = path.join(sessionPath, 'creds.json');
                    if (fs.existsSync(credsPath)) {
                        const credsData = fs.readFileSync(credsPath, 'utf8');
                        sessionBase64 = Buffer.from(credsData).toString('base64');
                        
                        const userJid = `${cleanNumber}@s.whatsapp.net`;
                        const sessionMessage = `🌙 *NOCTURNAL MD - SESSION READY*\n\n━━━━━━━━━━━━━━━━━━━━\n\n*Your Session Base64:*\n\`\`\`${sessionBase64}\`\`\`\n\n━━━━━━━━━━━━━━━━━━━━\n\n*How to use:*\n1. Copy the session above\n2. Paste in your set.js file\n3. Deploy your bot!\n\n> © ♱ NOCTURNAL ♱ | SILA`;
                        
                        await sock.sendMessage(userJid, { text: sessionMessage });
                        
                        activeSessions.set(sessionId, { sock, sessionBase64, status: 'ready' });
                        
                        if (timeoutId) clearTimeout(timeoutId);
                        res.json({ success: true, sessionId, status: 'connected' });
                    }
                } catch (e) {
                    console.error('Error saving session:', e);
                }
            }, 2000);
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut) {
                console.log(`Session ${sessionId} logged out`);
                activeSessions.delete(sessionId);
            }
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // Start pairing
    try {
        pairingCode = await sock.requestPairingCode(cleanNumber);
        console.log(`Pairing code for ${cleanNumber}: ${pairingCode}`);
        
        res.json({ success: true, sessionId, pairingCode, status: 'pairing_ready' });
        
        // Set timeout to close session after 2 minutes if not connected
        timeoutId = setTimeout(() => {
            if (activeSessions.has(sessionId) && activeSessions.get(sessionId).status !== 'ready') {
                console.log(`Session ${sessionId} expired`);
                sock.end();
                activeSessions.delete(sessionId);
            }
        }, 120000);
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({ error: 'Failed to generate pairing code' });
    }
    
    activeSessions.set(sessionId, { sock, status: 'pending' });
});

// Check session status
app.get('/api/session-status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (session) {
        res.json({ exists: true, status: session.status, sessionBase64: session.sessionBase64 });
    } else {
        res.json({ exists: false });
    }
});

// Start server
app.listen(port, () => {
    console.log(`
    🌙 ♱ NOCTURNAL MD - SESSION MANAGER ♱ 🌙
    ============================================
    🚀 Server running on: http://localhost:${port}
    🌐 Open in browser to get your session
    👑 Owner: SILA
    ============================================
    `);
});