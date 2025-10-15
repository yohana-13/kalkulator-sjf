let currentMode = 'noArrival';

function selectMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.mode-btn').classList.add('active');
    generateInputs();
}

function generateInputs() {
    const num = parseInt(document.getElementById('numProcesses').value);
    const container = document.getElementById('processInputs');
    const showArrival = currentMode !== 'noArrival';
    
    let html = `<div class="process-row" style="background: var(--primary-accent); color: white; font-weight: bold; border:none;">
                    <div>Proses</div><div>Burst Time</div>`;
    if (showArrival) { html += `<div>Arrival Time</div>`; }
    html += `</div>`;
    
    for (let i = 0; i < num; i++) {
        html += `<div class="process-row">
                    <div style="font-weight: 600; color: var(--primary-accent);">P${i + 1}</div>
                    <div><input type="number" id="burst${i}" value="${[6, 8, 7, 3][i] || 5}" min="1"></div>`;
        if (showArrival) {
            html += `<div><input type="number" id="arrival${i}" value="${[0, 1, 2, 3][i] || i}" min="0"></div>`;
        }
        html += `</div>`;
    }
    
    container.innerHTML = html;
}

function calculate() {
    const num = parseInt(document.getElementById('numProcesses').value);
    let processes = [];
    
    for (let i = 0; i < num; i++) {
        processes.push({
            id: `P${i + 1}`,
            burst: parseInt(document.getElementById(`burst${i}`).value),
            arrival: currentMode === 'noArrival' ? 0 : parseInt(document.getElementById(`arrival${i}`).value),
            remaining: parseInt(document.getElementById(`burst${i}`).value)
        });
    }

    let result;
    if (currentMode === 'noArrival' || currentMode === 'nonPreemptive') {
         result = calculateNonPreemptive(processes);
    } else if (currentMode === 'withArrival') {
         result = calculateNonPreemptive(processes);
    } else if (currentMode === 'preemptive') {
         result = calculatePreemptive(processes);
    }

    displayResults(result);
}

function calculateNonPreemptive(processes) {
    let steps = [];
    let sortedByArrival = [...processes].sort((a, b) => a.arrival - b.arrival);
    steps.push({
        title: "Langkah 1: Urutkan Proses Awal",
        contentData: { "Deskripsi": `Proses diurutkan berdasarkan Waktu Kedatangan (AT) untuk memulai simulasi.` },
        summary: `Urutan awal berdasarkan kedatangan: ${sortedByArrival.map(p => p.id).join(', ')}.`
    });

    let time = 0;
    let completed = [];
    let gantt = [];
    let remaining = [...sortedByArrival];
    let stepNum = 2;

    while (remaining.length > 0) {
        let available = remaining.filter(p => p.arrival <= time);
        
        if (available.length === 0) {
            time = remaining[0].arrival;
            continue;
        }

        available.sort((a, b) => a.burst - b.burst);
        let current = available[0];
        
        gantt.push({ process: current.id, start: time, end: time + current.burst });
        
        steps.push({
            title: `Langkah ${stepNum++}: Eksekusi ${current.id}`,
            contentData: {
                "Waktu Sekarang": time,
                "Proses Tersedia": available.map(p => `${p.id}(BT:${p.burst})`).join(', '),
                "Proses Dipilih": `${current.id} (BT Terpendek)`,
            },
            summary: `Proses ${current.id} dieksekusi dari T=${time} hingga T=${time + current.burst}.`
        });

        time += current.burst;
        current.completion = time;
        current.turnaround = current.completion - current.arrival;
        current.waiting = current.turnaround - current.burst;
        
        completed.push(current);
        remaining = remaining.filter(p => p.id !== current.id);
    }

    return { processes: completed, gantt, steps };
}

function calculatePreemptive(processes) {
    let steps = [];
    let time = 0;
    let completedCount = 0;
    let gantt = [];
    let procs = JSON.parse(JSON.stringify(processes));

    steps.push({
        title: "Langkah 1: Inisialisasi SRTF",
        contentData: { "Mode": "Preemptive (SRTF)" },
        summary: `CPU akan selalu memilih proses dengan sisa waktu (Remaining Time) terpendek di antara proses yang telah tiba.`
    });

    let lastProcessId = null;
    let segmentStart = 0;
    let stepNum = 2;

    while (completedCount < procs.length) {
        let available = procs.filter(p => p.arrival <= time && p.remaining > 0);
        
        if (available.length === 0) {
            time++;
            continue;
        }

        available.sort((a, b) => a.remaining - b.remaining);
        let current = available[0];

        if (lastProcessId !== current.id) {
            if (lastProcessId !== null) {
                gantt.push({ process: lastProcessId, start: segmentStart, end: time });
            }
            segmentStart = time;
            lastProcessId = current.id;
            steps.push({
                title: `Langkah ${stepNum++}: Waktu ${time} - CPU beralih ke ${current.id}`,
                contentData: {
                    "Waktu": time,
                    "Proses Tersedia": available.map(p => `${p.id}(sisa:${p.remaining})`).join(', '),
                    "Proses Dipilih": `${current.id} (Sisa Terpendek)`,
                },
                summary: `CPU mulai mengeksekusi ${current.id} karena memiliki sisa waktu paling sedikit.`
            });
        }

        current.remaining--;
        time++;

        if (current.remaining === 0) {
            current.completion = time;
            current.turnaround = current.completion - current.arrival;
            current.waiting = current.turnaround - current.burst;
            completedCount++;
            gantt.push({ process: lastProcessId, start: segmentStart, end: time });
            lastProcessId = null; 
        }
    }
    return { processes: procs, gantt, steps };
}

function displayResults(result) {
    const { processes, gantt, steps } = result;
    
    let avgWT = processes.reduce((sum, p) => sum + p.waiting, 0) / processes.length;
    let avgTAT = processes.reduce((sum, p) => sum + p.turnaround, 0) / processes.length;
    
    const processColors = ['#A0522D', '#CD853F', '#D2B48C', '#BC8F8F', '#F4A460', '#8B4513', '#D2691E', '#B87333', '#C4A484', '#966F33'];
    const totalDuration = gantt.length > 0 ? gantt[gantt.length - 1].end : 0;
    let barsHTML = '';
    let scalesHTML = '';

    if (gantt.length > 0) {
        scalesHTML += `<div class="gantt-scale-segment" style="flex-basis: 0;">${gantt[0].start}</div>`;
    }

    gantt.forEach((g) => {
        const duration = g.end - g.start;
        const percentageWidth = totalDuration > 0 ? (duration / totalDuration) * 100 : 100;
        const processIndex = parseInt(g.process.substring(1)) - 1;
        const color = processColors[processIndex % processColors.length];
        barsHTML += `<div class="gantt-bar-segment" style="width: ${percentageWidth}%; background-color: ${color};" title="${g.process} (${g.start} to ${g.end})">${g.process}</div>`;
        scalesHTML += `<div class="gantt-scale-segment" style="width: ${percentageWidth}%;">${g.end}</div>`;
    });

    const ganttChartHTML = `
        <div class="results-section gantt-wrapper">
            <h3>📊 Gantt Chart</h3>
            <div class="gantt-container">
                <div class="gantt-bar-container">${barsHTML}</div>
                <div class="gantt-scale-container">${scalesHTML}</div>
            </div>
        </div>
    `;

    const stepsHTML = `
        <div class="results-section steps-container">
            <h3>📝 Langkah-langkah Penyelesaian</h3>
            ${steps.map((step, index) => {
                const sortIcon = `<svg class="step-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" /></svg>`;
                const cpuIcon = `<svg class="step-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5M19.5 8.25h-1.5m-15 3.75h1.5m15 0h1.5m-15 3.75h1.5m15 0h1.5" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 9a3 3 0 100 6 3 3 0 000-6z" /></svg>`;
                const icon = index === 0 ? sortIcon : cpuIcon;
                
                const contentDetails = Object.entries(step.contentData)
                    .map(([key, value]) => `<div class="detail-item"><span>${key}</span><strong>${value}</strong></div>`)
                    .join('');

                return `
                    <div class="step-accordion">
                        <div class="step-header">
                            <div class="step-header-title">${icon}<span>${step.title}</span></div>
                            <span class="arrow">▼</span>
                        </div>
                        <div class="step-content">
                            <div class="step-details-grid">${contentDetails}</div>
                            <div class="step-summary"><p>${step.summary}</p></div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    const sortedProcesses = [...processes].sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric: true}));
    let tatCalcStrings = sortedProcesses.map(p => p.turnaround).join(' + ');
    let wtCalcStrings = sortedProcesses.map(p => p.waiting).join(' + ');

    const calculationHTML = `
        <div class="results-section calculation-details">
            <h3>🧮 Menghitung dengan Rumus</h3>
            <div class="calculation-grid">
                ${sortedProcesses.map(p => `
                    <div class="calc-block">
                        <h4>Proses ${p.id}</h4>
                        <div>
                            <div class="calc-formula">TAT = CT - AT</div>
                            <p>${p.turnaround} = ${p.completion} - ${p.arrival}</p>
                        </div>
                        <div style="margin-top: 15px;">
                            <div class="calc-formula">WT = TAT - BT</div>
                            <p>${p.waiting} = ${p.turnaround} - ${p.burst}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="calculation-grid" style="margin-top: 20px;">
                 <div class="calc-block">
                    <h4>Rata-rata Turnaround Time</h4>
                    <div class="calc-formula">Avg TAT = (Σ TAT) / N</div>
                    <p>${avgTAT.toFixed(2)} = (${tatCalcStrings}) / ${processes.length}</p>
                </div>
                <div class="calc-block">
                    <h4>Rata-rata Waiting Time</h4>
                    <div class="calc-formula">Avg WT = (Σ WT) / N</div>
                    <p>${avgWT.toFixed(2)} = (${wtCalcStrings}) / ${processes.length}</p>
                </div>
            </div>
        </div>
    `;
    
    let html = `
        ${stepsHTML}
        ${ganttChartHTML}
        ${calculationHTML}
        <div class="results-section">
            <h3 style="font-family: 'Cormorant Garamond', serif;">📋 Tabel Hasil</h3>
            <table>
                <thead>
                    <tr>
                        <th>Proses</th><th>Arrival Time</th><th>Burst Time</th><th>Completion Time</th><th>Turnaround Time</th><th>Waiting Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${processes.sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric: true})).map(p => `
                        <tr>
                            <td><strong>${p.id}</strong></td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.completion}</td><td>${p.turnaround}</td><td>${p.waiting}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="summary">
            <h3>✨ Ringkasan Hasil</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div>⏱ Average Waiting Time</div>
                    <div class="summary-value">${avgWT.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <div>🔄 Average Turnaround Time</div>
                    <div class="summary-value">${avgTAT.toFixed(2)}</div>
                </div>
            </div>
        </div>
    `;

    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
    
    document.querySelectorAll('.step-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('active');
        });
    });

    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

generateInputs();