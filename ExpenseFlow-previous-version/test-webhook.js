
const payload = {
    action: "sendMessage",
    sessionId: "sess_12345",
    chatInput: "hello"
};

fetch("https://n8n.skillednation.ai/webhook/d927bd76-dbf6-4793-97e1-6ce1c3251034/chat", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
    },
    body: JSON.stringify(payload)
})
.then(async res => {
    console.log("Status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Response body:", text);
})
.catch(err => {
    console.error("Fetch error:", err);
});
