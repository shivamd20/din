// Simple vanilla TS app

const logInput = document.getElementById('log-input') as HTMLTextAreaElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const charCount = document.getElementById('char-count') as HTMLSpanElement;
const statusIndicator = document.getElementById('status-indicator') as HTMLDivElement;
const historySection = document.getElementById('history-section') as HTMLElement;
const summarySection = document.getElementById('summary-section') as HTMLElement;
const summaryContent = document.getElementById('summary-content') as HTMLElement;

logInput.addEventListener('input', () => {
    charCount.textContent = logInput.value.length.toString();
});

submitBtn.addEventListener('click', async () => {
    const text = logInput.value.trim();
    if (!text) return;

    setLoading(true);

    try {
        const response = await fetch('/api/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) throw new Error('Failed to log');

        const result = await response.json();
        console.log("Logged:", result);

        logInput.value = '';
        charCount.textContent = '0';

        // Refresh today's view
        await loadToday();

    } catch (error) {
        console.error(error);
        alert('Failed to log entry');
    } finally {
        setLoading(false);
    }
});

function setLoading(isLoading: boolean) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Logging...' : 'Log';
    statusIndicator.className = isLoading
        ? "w-2 h-2 rounded-full bg-yellow-400 animate-pulse"
        : "w-2 h-2 rounded-full bg-green-500 scale-100 transition-transform";
}

async function loadToday() {
    try {
        const response = await fetch('/api/today');
        if (!response.ok) throw new Error('Failed to load');

        const data = await response.json() as any;

        if (data.summary) {
            summarySection.classList.remove('hidden');
            summaryContent.textContent = data.summary.summary_text || "No reflection yet.";
        }

        renderHistory(data.entries);
        statusIndicator.className = "w-2 h-2 rounded-full bg-green-500";
    } catch (error) {
        console.error(error);
        statusIndicator.className = "w-2 h-2 rounded-full bg-red-500";
    }
}

function renderHistory(entries: any[]) {
    historySection.innerHTML = '';

    if (!entries || entries.length === 0) {
        historySection.innerHTML = '<p class="text-center text-zinc-400 text-sm">No entries yet today.</p>';
        return;
    }

    // Show newest at top
    entries.slice().reverse().forEach((entry: any) => {
        const el = document.createElement('div');
        el.className = 'p-4 rounded-xl bg-white border border-zinc-100 shadow-sm transition-opacity animate-fade-in';

        const time = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        el.innerHTML = `
            <div class="text-xs text-zinc-400 mb-1">${time}</div>
            <div class="text-zinc-800 whitespace-pre-wrap">${entry.raw_text}</div>
        `;
        historySection.appendChild(el);
    });
}

// Initial load
loadToday();
