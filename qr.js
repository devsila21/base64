// QR Code Method Script
let sessionId = null;
let timerInterval = null;
let timeLeft = 120;
let statusCheckInterval = null;

async function generateSession() {
    try {
        const statusDiv = document.getElementById('status');
        statusDiv.className = 'status loading';
        statusDiv.innerHTML = '⏳ Generating QR Code...';
        
        const response = await fetch('/api/qr-session');
        const data = await response.json();
        
        if (data.success && data.qr) {
            sessionId = data.sessionId;
            
            // Display QR code
            const qrContainer = document.getElementById('qrContainer');
            qrContainer.innerHTML = `<img src="${data.qr}" alt="QR Code" style="animation: fadeInUp 0.5s ease;">`;
            
            // Update status
            statusDiv.className = 'status loading';
            statusDiv.innerHTML = '✅ QR Code generated! Scan with WhatsApp';
            
            // Start timer
            startTimer();
            
            // Start checking session status
            startStatusCheck();
            
            // Show instructions
            showInstructions();
            
        } else {
            statusDiv.className = 'status error';
            statusDiv.innerHTML = '❌ Failed to generate QR code. Please refresh and try again.';
            showToast('Failed to generate QR code', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        const statusDiv = document.getElementById('status');
        statusDiv.className = 'status error';
        statusDiv.innerHTML = '❌ Network error. Please check your connection.';
        showToast('Network error. Please refresh the page.', 'error');
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
            
            const statusDiv = document.getElementById('status');
            statusDiv.className = 'status error';
            statusDiv.innerHTML = '⏰ Session expired! Please refresh the page to generate a new QR.';
            
            // Disable further status checks
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
                statusCheckInterval = null;
            }
            
            showToast('Session expired. Please refresh.', 'error');
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
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'status success';
                statusDiv.innerHTML = '✅ Session generated successfully! Check your WhatsApp inbox or copy below.';
                
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
                
                // Remove QR container to show it's done
                const qrContainer = document.getElementById('qrContainer');
                qrContainer.style.opacity = '0.5';
                
                // Add checkmark overlay
                const checkmark = document.createElement('div');
                checkmark.innerHTML = '✅';
                checkmark.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 3rem;
                    color: #22c55e;
                    background: rgba(0,0,0,0.7);
                    border-radius: 50%;
                    padding: 10px;
                    animation: fadeInUp 0.3s ease;
                `;
                qrContainer.style.position = 'relative';
                qrContainer.appendChild(checkmark);
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 2000);
}

function showInstructions() {
    const instructions = document.createElement('div');
    instructions.id = 'instructions';
    instructions.style.cssText = `
        margin-top: 20px;
        padding: 15px;
        background: rgba(59, 130, 246, 0.1);
        border-radius: 12px;
        font-size: 0.8rem;
        color: #94a3b8;
        text-align: left;
        animation: fadeInUp 0.3s ease;
    `;
    instructions.innerHTML = `
        <strong>📌 How to use QR Code:</strong><br>
        1️⃣ Open WhatsApp on your phone<br>
        2️⃣ Go to Settings → Linked Devices<br>
        3️⃣ Tap "Link a Device"<br>
        4️⃣ Scan the QR code above<br>
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

// Add refresh option if QR fails
function addRefreshButton() {
    const card = document.querySelector('.card');
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '⟳ Refresh QR Code';
    refreshBtn.style.cssText = `
        margin-top: 15px;
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid rgba(59, 130, 246, 0.3);
        padding: 8px 16px;
        border-radius: 50px;
        color: #3b82f6;
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.3s ease;
    `;
    refreshBtn.onmouseover = () => {
        refreshBtn.style.background = 'rgba(59, 130, 246, 0.3)';
    };
    refreshBtn.onmouseout = () => {
        refreshBtn.style.background = 'rgba(59, 130, 246, 0.2)';
    };
    refreshBtn.onclick = () => {
        // Clear everything and regenerate
        if (timerInterval) clearInterval(timerInterval);
        if (statusCheckInterval) clearInterval(statusCheckInterval);
        
        const qrContainer = document.getElementById('qrContainer');
        qrContainer.innerHTML = '<div class="status loading">⏳ Generating new QR Code...</div>';
        
        const sessionSection = document.getElementById('sessionSection');
        sessionSection.style.display = 'none';
        
        const timerElement = document.getElementById('timer');
        timerElement.textContent = '02:00';
        timerElement.style.color = '#3b82f6';
        
        const instructionsDiv = document.getElementById('instructions');
        if (instructionsDiv) instructionsDiv.remove();
        
        generateSession();
    };
    
    card.appendChild(refreshBtn);
}

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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    generateSession();
    setTimeout(() => addRefreshButton(), 1000);
});
