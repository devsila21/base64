let sessionId = null;
let timerInterval = null;
let timeLeft = 120;

async function startPairing() {
    const phoneInput = document.getElementById('phoneNumber');
    let phoneNumber = phoneInput.value.trim();
    
    if (!phoneNumber) {
        alert('Please enter your phone number');
        return;
    }
    
    // Remove any non-digit characters
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    // Add 255 if not present
    if (!phoneNumber.startsWith('255') && !phoneNumber.startsWith('1')) {
        phoneNumber = '255' + phoneNumber;
    }
    
    const pairBtn = document.getElementById('pairBtn');
    pairBtn.disabled = true;
    pairBtn.textContent = 'Generating...';
    
    try {
        const response = await fetch('/api/pair-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber })
        });
        
        const data = await response.json();
        
        if (data.success && data.pairingCode) {
            sessionId = data.sessionId;
            
            // Show pairing code
            const pairingSection = document.getElementById('pairingSection');
            const pairingCodeSpan = document.getElementById('pairingCode');
            pairingCodeSpan.textContent = data.pairingCode;
            pairingSection.style.display = 'block';
            
            // Show timer section
            const timerSection = document.getElementById('timerSection');
            timerSection.style.display = 'block';
            
            // Start timer
            startTimer();
            
            // Check session status
            checkSessionStatus();
            
            const statusDiv = document.createElement('div');
            statusDiv.className = 'status loading';
            statusDiv.id = 'status';
            statusDiv.innerHTML = '✅ Pairing code generated! Enter it in WhatsApp';
            document.querySelector('.card').appendChild(statusDiv);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to generate pairing code. Please try again.');
    } finally {
        pairBtn.disabled = false;
        pairBtn.textContent = 'Generate Pairing Code →';
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
            if (statusDiv) {
                statusDiv.className = 'status error';
                statusDiv.innerHTML = '⏰ Session expired! Please refresh and try again.';
            }
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
                if (statusDiv) {
                    statusDiv.className = 'status success';
                    statusDiv.innerHTML = '✅ Session generated successfully! Copy your session below.';
                }
                
                const timerElement = document.getElementById('timer');
                if (timerElement) {
                    timerElement.style.color = '#22c55e';
                }
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