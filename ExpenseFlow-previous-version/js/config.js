// ============================================================
// CONFIG — All API endpoints and settings in one place
// Modify URLs here when your webhooks change
// ============================================================

const CONFIG = {
    // n8n Webhook: Add/create expenses in Zoho Books
    EXPENSE_WEBHOOK_URL: "https://n8n.skillednation.ai/webhook/zohobooks",

    // n8n Webhook: Get all expenses from Zoho Books
    GET_EXPENSES_URL: "https://n8n.skillednation.ai/webhook/getexpences",

    // n8n Webhook: AI Chat assistant
    CHAT_WEBHOOK_URL: "https://n8n.skillednation.ai/webhook/d927bd76-dbf6-4793-97e1-6ce1c3251034/chat",

    // n8n Webhook: Add/create income in Supabase
    INCOME_WEBHOOK_URL: "https://n8n.skillednation.ai/webhook/add-income",

    // n8n Webhook: Get all income from Supabase
    GET_INCOMES_URL: "https://n8n.skillednation.ai/webhook/get-income",

    // n8n Webhook: Create new dynamic company
    CREATE_COMPANY_URL: "https://n8n.skillednation.ai/webhook/create_company",

    // n8n Webhook: Get all company names
    COMPANY_NAMES_URL: "https://n8n.skillednation.ai/webhook/company_names",
};

