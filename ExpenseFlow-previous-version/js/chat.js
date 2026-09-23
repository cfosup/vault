// ============================================================
// ENHANCED CHAT WIDGET — Rich AI Assistant
// ============================================================

// Uses CONFIG.CHAT_WEBHOOK_URL from config.js

const chatPanel = document.getElementById('chatPanel');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSend');
const chatError = document.getElementById('chatError');

let chatOpen = false;
let chatSessionId = sessionStorage.getItem('chatSessionId') || 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
sessionStorage.setItem('chatSessionId', chatSessionId);

// ---- Detect current page context ----
function getPageContext() {
    const path = window.location.pathname;
    if (path.includes('dashboard')) return 'dashboard';
    if (path.includes('expenses')) return 'expenses';
    if (path.includes('income')) return 'income';
    return 'expense-form';
}

// ---- Toggle chat panel ----
function toggleChat() {
    chatOpen = !chatOpen;
    chatPanel.classList.toggle('visible', chatOpen);
    document.getElementById('chatIconOpen').style.display = chatOpen ? 'none' : 'block';
    document.getElementById('chatIconClose').style.display = chatOpen ? 'block' : 'none';
    if (chatOpen) chatInput.focus();
}

// ---- Format timestamp ----
function formatTime(date) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ---- Render rich text from bot response ----
function renderRichText(text) {
    if (!text) return '';
    let html = text;
    
    // Escape HTML first
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Code blocks (inline)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Highlight currency amounts (₹ followed by numbers)
    html = html.replace(/(₹[\d,\.]+(?:\s*(?:Cr|L|K|Lakh|Crore))?)/g, '<span class="chat-amount">$1</span>');
    
    // Convert line breaks
    html = html.replace(/\n/g, '<br>');
    
    // Convert bullet lists (lines starting with - or • )
    html = html.replace(/(?:^|<br>)\s*[-•]\s+(.+?)(?=<br>|$)/g, '<li>$1</li>');
    if (html.includes('<li>')) {
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul class="chat-list">$1</ul>');
    }
    
    // Convert numbered lists
    html = html.replace(/(?:^|<br>)\s*(\d+)\.\s+(.+?)(?=<br>|$)/g, '<li>$2</li>');
    
    return html;
}

// ---- Append message ----
function appendMsg(text, sender, save = true) {
    const div = document.createElement('div');
    div.className = `chat-msg ${sender}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'chat-msg-content';
    
    if (sender === 'bot') {
        contentDiv.innerHTML = renderRichText(text);
        // Copy on click for bot messages
        div.style.cursor = 'pointer';
        div.title = 'Click to copy';
        div.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => {
                if (typeof showToast === 'function') showToast('Copied to clipboard', 'info', 2000);
            });
        });
    } else {
        contentDiv.textContent = text;
    }
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'chat-msg-time';
    timeDiv.textContent = formatTime(new Date());
    
    div.appendChild(contentDiv);
    div.appendChild(timeDiv);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Save to session storage
    if (save) saveChatHistory();
}

// ---- Quick action chips ----
function renderQuickActions() {
    const existing = document.getElementById('quickActions');
    if (existing) return; // Already rendered
    
    const prompts = [
        { icon: '📊', text: 'Show my spending summary' },
        { icon: '💰', text: "What's my savings rate?" },
        { icon: '📈', text: 'Top expense categories?' },
        { icon: '💳', text: 'Payment method breakdown' },
    ];
    
    const container = document.createElement('div');
    container.id = 'quickActions';
    container.className = 'chat-quick-actions';
    container.innerHTML = prompts.map(p => 
        `<button class="chat-quick-chip" onclick="sendQuickAction('${p.text}')">${p.icon} ${p.text}</button>`
    ).join('');
    
    chatMessages.appendChild(container);
}

window.sendQuickAction = function(text) {
    // Remove quick actions after use
    const qa = document.getElementById('quickActions');
    if (qa) qa.remove();
    
    chatInput.value = text;
    sendChatMessage();
};

// ---- Chat history persistence ----
function saveChatHistory() {
    const msgs = [];
    chatMessages.querySelectorAll('.chat-msg').forEach(el => {
        const content = el.querySelector('.chat-msg-content');
        const time = el.querySelector('.chat-msg-time');
        if (content) {
            msgs.push({
                sender: el.classList.contains('user') ? 'user' : 'bot',
                text: content.innerHTML, // Keep processed html or text
                rawText: content.textContent,
                time: time ? time.textContent : ''
            });
        }
    });
    sessionStorage.setItem('chatHistory', JSON.stringify(msgs));
}

function restoreChatHistory() {
    const saved = sessionStorage.getItem('chatHistory');
    if (!saved) return false;
    
    try {
        const msgs = JSON.parse(saved);
        if (msgs.length === 0) return false;
        
        // Clear default welcome message
        chatMessages.innerHTML = '';
        
        msgs.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-msg ${msg.sender}`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'chat-msg-content';
            
            if (msg.sender === 'bot') {
                contentDiv.innerHTML = msg.text; // Restore with formatting
                div.style.cursor = 'pointer';
                div.title = 'Click to copy';
                div.addEventListener('click', () => {
                    navigator.clipboard.writeText(msg.rawText || contentDiv.textContent).then(() => {
                        if (typeof showToast === 'function') showToast('Copied to clipboard', 'info', 2000);
                    });
                });
            } else {
                contentDiv.textContent = msg.rawText || msg.text;
            }
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'chat-msg-time';
            timeDiv.textContent = msg.time || '';
            
            div.appendChild(contentDiv);
            div.appendChild(timeDiv);
            chatMessages.appendChild(div);
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return true;
    } catch {
        return false;
    }
}

// ---- Clear chat ----
window.clearChat = function() {
    sessionStorage.removeItem('chatHistory');
    chatSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    sessionStorage.setItem('chatSessionId', chatSessionId);
    
    chatMessages.innerHTML = '';
    appendMsg("Hello! I'm your ExpenseFlow assistant. How can I help you today?", 'bot');
    renderQuickActions();
    
    if (typeof showToast === 'function') showToast('Chat cleared', 'info', 2000);
};

// ---- Typing indicator ----
function showTyping() {
    const div = document.createElement('div');
    div.className = 'chat-msg typing';
    div.id = 'typingDots';
    div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
    const el = document.getElementById('typingDots');
    if (el) el.remove();
}

// ---- Error display ----
function showChatError(msg) {
    chatError.textContent = msg;
    chatError.style.display = 'block';
    setTimeout(() => { chatError.style.display = 'none'; }, 6000);
}

// ---- Parse response ----
function parseResponse(data) {
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (data.output) return data.output;
    if (data.text) return data.text;
    if (data.message) return data.message;
    if (data.response) return data.response;
    if (data.content) return data.content;
    if (data.answer) return data.answer;
    if (data.result) return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
    if (Array.isArray(data)) {
        if (data.length === 0) return "No response received.";
        return parseResponse(data[0]);
    }
    return JSON.stringify(data);
}

// ---- Send message ----
async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendMsg(text, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatSendBtn.disabled = true;
    chatError.style.display = 'none';
    showTyping();

    // Check if quick actions are present and remove them
    const qa = document.getElementById('quickActions');
    if (qa) qa.remove();

    const payload = {
        action: "sendMessage",
        sessionId: chatSessionId,
        chatInput: text,
        pageContext: getPageContext()
    };

    try {
        const res = await fetch(CONFIG.CHAT_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        });

        hideTyping();

        if (!res.ok) {
            appendMsg("Sorry, something went wrong. Please try again.", 'bot');
            showChatError(`Webhook returned ${res.status}. Check your n8n workflow.`);
            return;
        }

        const contentType = res.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
            data = await res.json();
        } else {
            const rawText = await res.text();
            try { data = JSON.parse(rawText); } catch { data = rawText; }
        }

        const reply = parseResponse(data);
        appendMsg(reply || "Received an empty response.", 'bot');

    } catch (err) {
        hideTyping();
        appendMsg("Could not connect to the assistant.", 'bot');
        showChatError("Network error — check that n8n is running and CORS is enabled.");
    } finally {
        chatSendBtn.disabled = false;
        chatInput.focus();
    }
}

// ---- Keyboard shortcuts ----
chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

// ---- Auto-resize textarea ----
chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 90) + 'px';
});

// ---- Initialize ----
const hasHistory = restoreChatHistory();
if (!hasHistory) {
    renderQuickActions();
}
