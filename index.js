const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Create temp directory
const tempDir = path.join(__dirname, 'temp');
fs.ensureDirSync(tempDir);

// Store active sessions
const activeSessions = new Map();

// Bot configuration
const BOT_NAME = "NOCTURNAL";
const BOT_OWNER = "SILA";
const BOT_VERSION = "4.0.0";

// Helper function to remove temp folder
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
    return true;
}

// Generate random ID
function makeid(length = 8) {
    return crypto.randomBytes(length).toString('hex');
}

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

// QR Code session endpoint
app.get('/api/qr-session', async (req, res) => {
    const sessionId = makeid();
    let qrSent = false;
    let sessionBase64 = null;
    let timeoutId = null;

    async function generateQR() {
        const sessionPath = path.join(tempDir, sessionId);
        fs.ensureDirSync(sessionPath);
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        try {
            const sock = makeWASocket({
                version: (await (await fetch('https://raw.githubusercontent.com/WhiskeySockets/Baileys/master/src/Defaults/baileys-version.json')).json()).version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers("Chrome"),
                getMessage: async () => undefined
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr && !qrSent) {
                    qrSent = true;
                    const qrDataUrl = await (async () => {
                        const QRCode = require('qrcode');
                        return await QRCode.toDataURL(qr);
                    })();
                    
                    if (!res.headersSent) {
                        res.json({ success: true, sessionId, qr: qrDataUrl, status: 'qr_ready' });
                    }
                    
                    // Set timeout for QR expiration
                    timeoutId = setTimeout(() => {
                        if (activeSessions.get(sessionId)?.status !== 'connected') {
                            sock.end();
                            removeFile(sessionPath);
                            activeSessions.delete(sessionId);
                        }
                    }, 120000);
                }

                if (connection === "open") {
                    console.log(`✅ Session ${sessionId} connected!`);
                    
                    await delay(3000);
                    
                    try {
                        const credsPath = path.join(sessionPath, 'creds.json');
                        if (fs.existsSync(credsPath)) {
                            const credsData = fs.readFileSync(credsPath, 'utf8');
                            sessionBase64 = Buffer.from(credsData).toString('base64');
                            
                            // Send session to user's inbox
                            const userJid = sock.user.id;
                            const sessionMessage = `
╔══════════════════════════════════╗
║  🌙 ♱ NOCTURNAL MD ♱ 🌙
╠══════════════════════════════════╣
║  ✅ *SESSION GENERATED SUCCESSFULLY*
╠══════════════════════════════════╣
║  📋 *Your Session Base64:*
║  
║  \`${sessionBase64}\`
║  
╠══════════════════════════════════╣
║  📌 *How to Use:*
║  1. Copy the session above
║  2. Paste in your set.js file
║  3. Deploy your bot!
╠══════════════════════════════════╣
║  🧑‍💻 *Owner:* SILA
║  🤖 *Bot:* NOCTURNAL MD
║  📦 *Version:* ${BOT_VERSION}
╚══════════════════════════════════╝
`;
                            await sock.sendMessage(userJid, { text: sessionMessage });
                            
                            activeSessions.set(sessionId, { 
                                sock, 
                                sessionBase64, 
                                status: 'connected',
                                userJid 
                            });
                            
                            if (timeoutId) clearTimeout(timeoutId);
                            
                            // Close connection after 5 seconds
                            setTimeout(() => {
                                sock.end();
                                removeFile(sessionPath);
                            }, 5000);
                        }
                    } catch (e) {
                        console.error('Error saving session:', e);
                    }
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    console.log(`Session ${sessionId} closed, restarting...`);
                    await delay(5000);
                    generateQR();
                }
            });

            activeSessions.set(sessionId, { sock, status: 'pending' });

        } catch (err) {
            console.log("Service error:", err);
            removeFile(sessionPath);
            if (!res.headersSent) {
                res.json({ success: false, error: "Service is currently unavailable" });
            }
        }
    }

    return await generateQR();
});

// Pairing code session endpoint
app.get('/api/pair-session', async (req, res) => {
    const sessionId = makeid();
    let num = req.query.number;
    let pairingCodeSent = false;
    let sessionBase64 = null;
    let timeoutId = null;

    if (!num) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    async function generatePairingCode() {
        const sessionPath = path.join(tempDir, sessionId);
        fs.ensureDirSync(sessionPath);
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        try {
            const sock = makeWASocket({
                version: (await (await fetch('https://raw.githubusercontent.com/WhiskeySockets/Baileys/master/src/Defaults/baileys-version.json')).json()).version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers("Chrome"),
                getMessage: async () => undefined
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr && !pairingCodeSent && !sock.authState.creds.registered) {
                    // QR fallback - ignore, use pairing code instead
                }

                if (connection === "open") {
                    console.log(`✅ Session ${sessionId} connected!`);
                    
                    await delay(3000);
                    
                    try {
                        const credsPath = path.join(sessionPath, 'creds.json');
                        if (fs.existsSync(credsPath)) {
                            const credsData = fs.readFileSync(credsPath, 'utf8');
                            sessionBase64 = Buffer.from(credsData).toString('base64');
                            
                            // Send session to user's inbox
                            const userJid = `${cleanNumber(num)}@s.whatsapp.net`;
                            const sessionMessage = `
╔══════════════════════════════════╗
║  🌙 ♱ NOCTURNAL MD ♱ 🌙
╠══════════════════════════════════╣
║  ✅ *SESSION GENERATED SUCCESSFULLY*
╠══════════════════════════════════╣
║  📋 *Your Session Base64:*
║  
║  \`${sessionBase64}\`
║  
╠══════════════════════════════════╣
║  📌 *How to Use:*
║  1. Copy the session above
║  2. Paste in your set.js file
║  3. Deploy your bot!
╠══════════════════════════════════╣
║  🧑‍💻 *Owner:* SILA
║  🤖 *Bot:* NOCTURNAL MD
║  📦 *Version:* ${BOT_VERSION}
╚══════════════════════════════════╝
`;
                            await sock.sendMessage(userJid, { text: sessionMessage });
                            
                            activeSessions.set(sessionId, { 
                                sock, 
                                sessionBase64, 
                                status: 'connected',
                                userJid 
                            });
                            
                            if (timeoutId) clearTimeout(timeoutId);
                            
                            // Close connection after 5 seconds
                            setTimeout(() => {
                                sock.end();
                                removeFile(sessionPath);
                            }, 5000);
                        }
                    } catch (e) {
                        console.error('Error saving session:', e);
                    }
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    console.log(`Session ${sessionId} closed, restarting...`);
                    await delay(5000);
                    generatePairingCode();
                }
            });

            // Generate pairing code
            try {
                await delay(1500);
                let cleanPhone = num.replace(/[^0-9]/g, '');
                if (!cleanPhone.startsWith('255') && !cleanPhone.startsWith('1')) {
                    cleanPhone = '255' + cleanPhone;
                }
                
                const code = await sock.requestPairingCode(cleanPhone);
                console.log(`Pairing code for ${cleanPhone}: ${code}`);
                
                if (!res.headersSent) {
                    res.json({ success: true, sessionId, pairingCode: code, status: 'pairing_ready' });
                }
                
                activeSessions.set(sessionId, { sock, status: 'pending', phone: cleanPhone });
                
                // Set timeout for pairing expiration
                timeoutId = setTimeout(() => {
                    if (activeSessions.get(sessionId)?.status !== 'connected') {
                        sock.end();
                        removeFile(sessionPath);
                        activeSessions.delete(sessionId);
                    }
                }, 120000);
                
            } catch (e) {
                console.log("Pairing code error:", e.message);
                if (!res.headersSent) {
                    res.json({ success: false, error: "Failed to generate pairing code" });
                }
                removeFile(sessionPath);
            }

        } catch (err) {
            console.log("Service error:", err);
            removeFile(sessionPath);
            if (!res.headersSent) {
                res.json({ success: false, error: "Service is currently unavailable" });
            }
        }
    }
    
    return await generatePairingCode();
});

// Clean phone number function
function cleanNumber(num) {
    let clean = num.replace(/[^0-9]/g, '');
    if (!clean.startsWith('255') && !clean.startsWith('1')) {
        clean = '255' + clean;
    }
    return clean;
}

// Check session status
app.get('/api/session-status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (session) {
        res.json({ 
            exists: true, 
            status: session.status, 
            sessionBase64: session.sessionBase64 
        });
        
        // Clean up after sending
        if (session.status === 'connected') {
            setTimeout(() => {
                activeSessions.delete(sessionId);
            }, 10000);
        }
    } else {
        res.json({ exists: false });
    }
});

// Start server
app.listen(port, () => {
    console.log(`
    ╔════════════════════════════════════════╗
    ║  🌙 ♱ NOCTURNAL MD - SESSION MANAGER ♱ 🌙
    ╠════════════════════════════════════════╣
    ║  🚀 Server: http://localhost:${port}
    ║  👑 Owner: SILA
    ║  🤖 Bot: NOCTURNAL MD
    ║  📦 Version: ${BOT_VERSION}
    ╚════════════════════════════════════════╝
    `);
});
