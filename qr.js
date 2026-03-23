let sessionId = null;
let timerInterval = null;
let timeLeft = 120; // 2 minutes in seconds

async function generateSession() {
    try {
        const response = await fetch('/api/qr-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success && data.qr) {
            sessionId = data.sessionId;
            
            // Display QR code
            const qrContainer = document.getElementById('qrContainer');
            qrContainer.innerHTML = `<img src="${data.qr}" alt="QR Code">`;
            
            const statusDiv = document.getElementById('status');
            statusDiv.className = 'status loading';
            statusDiv.innerHTML = '✅ QR Code generated! Scan with WhatsApp';
            
            // Start timer
            startTimer();
            
            // Check session status
            checkSessionStatus();
        }
    } catch (error) {
        console.error('Error:', error);
        const statusDiv = document.getElementById('status');
        statusDiv.className = 'status error';
        statusDiv.innerHTML = '❌ Failed to generate QR code. Please try again.';
    }
}

function startTimer() {
    const timerElement = document.getElementById('timer');
    timerInterval = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerElement.textContent = '00:00';
            const statusDiv = document.getElementById('status');
            statusDiv.className = 'status error';
            statusDiv.innerHTML = '⏰ Session expired! Please refresh the page to generate a new QR.';
        }
    }, 1000);
}

async function checkSessionStatus() {
    const checkInterval = setInterval(async () => {
        if (!sessionId) return;
        
        try {
            const response = await fetch(`/api/session-status/${sessionId}`);
            const data = await response.json();
            
            if (data.exists && data.status === 'ready' && data.sessionBase64) {
                clearInterval(checkInterval);
                clearInterval(timerInterval);
                
                // Show session
                const sessionSection = document.getElementById('sessionSection');
                const sessionTextarea = document.getElementById('sessionBase64');
                
                sessionTextarea.value = data.sessionBase64;
                sessionSection.style.display = 'block';
                
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'status success';
                statusDiv.innerHTML = '✅ Session generated successfully! Copy your session below.';
                
                const timerElement = document.getElementById('timer');
                timerElement.style.color = '#22c55e';
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 2000);
}

function copySession() {
    const sessionTextarea = document.getElementById('sessionBase64');
    sessionTextarea.select();
    document.execCommand('copy');
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = '📋 Session copied to clipboard!';
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// Generate session on page load
generateSession();