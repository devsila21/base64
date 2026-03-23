// Pairing Method Script
let sessionId = null;
let timerInterval = null;
let timeLeft = 120;
let statusCheckInterval = null;

async function startPairing() {
    const phoneInput = document.getElementById('phoneNumber');
    let phoneNumber = phoneInput.value.trim();
    
    if (!phoneNumber) {
        showToast('Please enter your phone number', 'error');
        return;
    }
    
    // Clean phone number - remove any non-digit characters
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    if (phoneNumber.length < 9) {
        showToast('Please enter a valid phone number (minimum 9 digits)', 'error');
        return;
    }
    
    const pairBtn = document.getElementById('pairBtn');
    const originalText = pairBtn.textContent;
    pairBtn.disabled = true;
    pairBtn.textContent = '⏳ Generating...';
    
    // Clear previous session data
    clearPreviousSession();
    
    try {
        const response = await fetch(`/api/pair-session?number=${phoneNumber}`);
        const data = await response.json();
        
        if (data.success && data.pairingCode) {
            sessionId = data.sessionId;
            
            // Show pairing code section
            const pairingSection = document.getElementById('pairingSection');
            const pairingCodeSpan = document.getElementById('pairingCode');
            pairingCodeSpan.textContent = data.pairingCode;
            pairingSection.style.display = 'block';
            
            // Add animation to pairing code
            pairingCodeSpan.style.animation = 'pulse 1s ease-in-out';
            setTimeout(() => {
                pairingCodeSpan.style.animation = '';
            }, 1000);
            
            // Show timer section
            const timerSection = document.getElementById('timerSection');
            timerSection.style.display = 'block';
            
            // Start timer
            startTimer();
            
            // Add status message
            addStatusMessage('✅ Pairing code generated! Enter this code in WhatsApp', 'loading');
            
            // Start checking session status
            startStatusCheck();
            
            // Show instructions
            showInstructions();
            
        } else {
            showToast(data.error || 'Failed to generate pairing code. Please try again.', 'error');
            addStatusMessage('❌ Failed to generate pairing code. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
        addStatusMessage('❌ Network error. Please refresh and try again.', 'error');
    } finally {
        pairBtn.disabled = false;
        pairBtn.textContent = originalText;
    }
}

function startTimer() {
    const timerElement = document.getElementById('timer');
    timeLeft = 120;
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when time is running low
        if (timeLeft <= 30) {
            timerElement.style.color = '#ef4444';
        } else if (timeLeft <= 60) {
            timerElement.style.color = '#f59e0b';
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerElement.textContent = '00:00';
            timerElement.style.color = '#ef4444';
            addStatusMessage('⏰ Session expired! Please refresh and try again.', 'error');
            
            // Disable further status checks
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
                statusCheckInterval = null;
            }
        }
    }, 1000);
}

function startStatusCheck() {
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    
    statusCheckInterval = setInterval(async () => {
        if (!sessionId) return;
        
        try {
            const response = await fetch(`/api/session-status/${sessionId}`);
            const data = await response.json();
            
            if (data.exists && data.status === 'connected' && data.sessionBase64) {
                // Session is ready!
                clearInterval(statusCheckInterval);
                statusCheckInterval = null;
                clearInterval(timerInterval);
                
                // Show session section
                const sessionSection = document.getElementById('sessionSection');
                const sessionTextarea = document.getElementById('sessionBase64');
                
                sessionTextarea.value = data.sessionBase64;
                sessionSection.style.display = 'block';
                
                // Add success animation
                sessionSection.style.animation = 'fadeInUp 0.5s ease';
                
                // Update status
                updateStatusMessage('✅ Session generated successfully! Check your WhatsApp inbox or copy below.', 'success');
                
                // Update timer color
                const timerElement = document.getElementById('timer');
                timerElement.style.color = '#22c55e';
                
                // Show copy button highlight
                const copyBtn = document.querySelector('.copy-btn');
                if (copyBtn) {
                    copyBtn.style.animation = 'pulse 0.5s ease 3';
                }
                
                // Auto select text for easy copy
                sessionTextarea.select();
                
                // Show success toast
                showToast('Session ready! Copy your session now.', 'success');
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 2000);
}

function clearPreviousSession() {
    // Hide pairing section
    const pairingSection = document.getElementById('pairingSection');
    pairingSection.style.display = 'none';
    
    // Hide timer section
    const timerSection = document.getElementById('timerSection');
    timerSection.style.display = 'none';
    
    // Hide session section
    const sessionSection = document.getElementById('sessionSection');
    sessionSection.style.display = 'none';
    
    // Clear existing status
    const existingStatus = document.getElementById('dynamicStatus');
    if (existingStatus) existingStatus.remove();
    
    // Clear intervals
    if (timerInterval) clearInterval(timerInterval);
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    
    sessionId = null;
}

function addStatusMessage(message, type) {
    // Remove existing status
    const existingStatus = document.getElementById('dynamicStatus');
    if (existingStatus) existingStatus.remove();
    
    // Create new status
    const statusDiv = document.createElement('div');
    statusDiv.id = 'dynamicStatus';
    statusDiv.className = `status ${type}`;
    statusDiv.innerHTML = message;
    
    // Insert after pairing section or timer section
    const card = document.querySelector('.card');
    const timerSection = document.getElementById('timerSection');
    
    if (timerSection.style.display === 'block') {
        timerSection.insertAdjacentElement('afterend', statusDiv);
    } else {
        const pairBtn = document.getElementById('pairBtn');
        pairBtn.insertAdjacentElement('afterend', statusDiv);
    }
}

function updateStatusMessage(message, type) {
    const statusDiv = document.getElementById('dynamicStatus');
    if (statusDiv) {
        statusDiv.className = `status ${type}`;
        statusDiv.innerHTML = message;
    } else {
        addStatusMessage(message, type);
    }
}

function showInstructions() {
    const instructions = document.createElement('div');
    instructions.id = 'instructions';
    instructions.style.cssText = `
        margin-top: 15px;
        padding: 12px;
        background: rgba(59, 130, 246, 0.1);
        border-radius: 12px;
        font-size: 0.8rem;
        color: #94a3b8;
        text-align: left;
        animation: fadeInUp 0.3s ease;
    `;
    instructions.innerHTML = `
        <strong>📌 How to use pairing code:</strong><br>
        1️⃣ Open WhatsApp on your phone<br>
        2️⃣ Go to Settings → Linked Devices<br>
        3️⃣ Tap "Link with phone number"<br>
        4️⃣ Enter the code above<br>
        5️⃣ Wait for connection (takes 10-30 seconds)<br>
        <span style="color: #3b82f6;">✨ Session will appear here and in your WhatsApp inbox!</span>
    `;
    
    const card = document.querySelector('.card');
    const existingInstructions = document.getElementById('instructions');
    if (existingInstructions) existingInstructions.remove();
    card.appendChild(instructions);
}

function copySession() {
    const sessionTextarea = document.getElementById('sessionBase64');
    
    if (!sessionTextarea.value) {
        showToast('No session to copy!', 'error');
        return;
    }
    
    sessionTextarea.select();
    sessionTextarea.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('📋 Session copied to clipboard!', 'success');
            
            // Change copy button text temporarily
            const copyBtn = event.target;
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        } else {
            showToast('Failed to copy. Please select manually.', 'error');
        }
    } catch (err) {
        showToast('Failed to copy. Please select and copy manually.', 'error');
    }
}

function showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#22c55e' : '#ef4444'};
        color: white;
        padding: 12px 24px;
        border-radius: 50px;
        font-size: 0.9rem;
        animation: fadeInUp 0.3s ease;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    toast.innerHTML = message;
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add keyboard support for Enter key
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('phoneNumber');
    if (phoneInput) {
        phoneInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                startPairing();
            }
        });
    }
});

// Add CSS animations if not present
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
    }
    
    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.05);
        }
    }
`;
document.head.appendChild(style);
