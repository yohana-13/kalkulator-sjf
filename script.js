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
    
    let html = `<div class="process-row header-row">
                    <div>Proses</div><div>Burst Time</div>`;
    if (showArrival) { 
        html += `<div>Arrival Time</div>`;
    }
    html += `</div>`;
    
    // Default values
    const defaultBursts = [8, 10, 6, 3, 5, 7, 4, 9, 2, 5];
    const defaultArrivals = [2, 8, 17, 20, 4, 5, 6, 7, 8, 9];
    
    for (let i = 0; i < num; i++) {
        html += `<div class="process-row">
                    <div class="process-label">P${i + 1}</div>
                    <div><input type="number" id="burst${i}" value="${defaultBursts[i] || 5}" min="1" placeholder="Burst Time"></div>`;
        if (showArrival) {
            html += `<div><input type="number" id="arrival${i}" value="${defaultArrivals[i] || i}" min="0" placeholder="Arrival Time"></div>`;
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
            remaining: parseInt(document.getElementById(`burst${i}`).value),
            originalIndex: i
        });
    }

    let result;
    if (currentMode === 'noArrival') {
        result = calculateNoArrival(processes);
    } else if (currentMode === 'withArrival' || currentMode === 'nonPreemptive') {
        result = calculateNonPreemptive(processes);
    } else if (currentMode === 'preemptive') {
        result = calculatePreemptive(processes);
    }

    displayResults(result);
}

function calculateNoArrival(processes) {
    let steps = [];
    
    let sortedByBurst = [...processes].sort((a, b) => a.burst - b.burst);
    
    steps.push({
        title: "Langkah 1: Mengurutkan Proses",
        contentData: { 
            "Deskripsi": `Semua proses datang bersamaan (AT=0), jadi langsung diurutkan berdasarkan Burst Time terkecil.`,
            "Urutan Proses": sortedByBurst.map(p => `${p.id}(BT:${p.burst})`).join(' → '),
            "Strategi": "Shortest Job First"
        },
        summary: `Urutan eksekusi ditentukan: ${sortedByBurst.map(p => p.id).join(' → ')}.`
    });

    let time = 0;
    let completed = [];
    let gantt = [];
    let stepNum = 2;

    sortedByBurst.forEach((current, index) => {
        const startTime = time;
        const endTime = time + current.burst;
        
        gantt.push({ process: current.id, start: startTime, end: endTime });
        
        steps.push({
            title: `Langkah ${stepNum}: Mengeksekusi ${current.id}`,
            contentData: {
                "Waktu Mulai": startTime,
                "Waktu Selesai": endTime,
                "Proses": `${current.id} (BT: ${current.burst})`,
                "Status": `Dieksekusi tanpa interupsi`
            },
            summary: `Aksi dimulai! ${current.id} dieksekusi dari T=${startTime} hingga T=${endTime}.`
        });

        time = endTime;
        current.completion = time;
        current.turnaround = current.completion - current.arrival;
        current.waiting = current.turnaround - current.burst;
        
        completed.push(current);
        stepNum++;
    });

    steps.push({
        title: "Langkah " + stepNum + ": Kalkulasi Akhir",
        contentData: {
            "Total Waktu": time,
            "Rumus TAT": "CT - AT",
            "Rumus WT": "TAT - BT"
        },
        summary: `Semua proses telah selesai. Saatnya menghitung performa penjadwalan.`
    });

    return { processes: completed, gantt, steps };
}

function calculateNonPreemptive(processes) {
    let steps = [];
    
    let sortedByArrival = [...processes].sort((a, b) => {
        if (a.arrival === b.arrival) return a.burst - b.burst;
        return a.arrival - b.arrival;
    });
    
    steps.push({
        title: "Langkah 1: Proses Tiba",
        contentData: { 
            "Deskripsi": `Proses diurutkan berdasarkan waktu kedatangan (Arrival Time). Jika ada yang datang bersamaan, dahulukan yang Burst Time-nya terkecil.`,
            "Urutan Awal": sortedByArrival.map(p => `${p.id}(AT:${p.arrival}, BT:${p.burst})`).join(' → ')
        },
        summary: `Antrian awal terbentuk berdasarkan siapa yang datang lebih dulu.`
    });

    let time = 0;
    let completed = [];
    let gantt = [];
    let remaining = [...sortedByArrival];
    let stepNum = 2;
    
    if (remaining.length > 0 && remaining[0].arrival > 0) {
         time = remaining[0].arrival;
         steps.push({
            title: `Langkah ${stepNum}: Menunggu Proses Pertama`,
            contentData: {
                "Waktu Sekarang": 0,
                "Proses Tersedia": "Tidak ada",
                "Tindakan": `CPU menganggur`,
                "Proses Berikutnya": `${remaining[0].id} (Tiba di T=${time})`
            },
            summary: `Waktu berlalu... CPU beristirahat sejenak hingga T=${time}, menunggu proses pertama untuk tiba.`
        });
        stepNum++;
    }

    while (remaining.length > 0) {
        let available = remaining.filter(p => p.arrival <= time);
        
        if (available.length === 0) {
            const nextArrival = Math.min(...remaining.map(p => p.arrival));
            steps.push({
                title: `Langkah ${stepNum}: CPU Menganggur`,
                contentData: {
                    "Waktu Sekarang": time,
                    "Proses Tersedia": "Tidak ada",
                    "Tindakan": `Maju ke waktu kedatangan berikutnya`,
                    "Proses Berikutnya": `Tiba di T=${nextArrival}`
                },
                summary: `Tidak ada pekerjaan saat ini. CPU menganggur lagi hingga T=${nextArrival}.`
            });
            time = nextArrival;
            stepNum++;
            continue;
        }

        available.sort((a, b) => a.burst - b.burst);
        let current = available[0];
        
        const startTime = time;
        const endTime = time + current.burst;
        
        steps.push({
            title: `Langkah ${stepNum}: Mengeksekusi ${current.id}`,
            contentData: {
                "Waktu Sekarang": time,
                "Proses Tersedia": available.map(p => `${p.id}(BT:${p.burst})`).join(', '),
                "Proses Dipilih": `${current.id} (BT Terpendek)`,
                "Waktu Eksekusi": `${startTime} → ${endTime}`
            },
            summary: `Aksi dimulai! ${current.id} terpilih dan dieksekusi dari T=${startTime} hingga T=${endTime}.`
        });

        gantt.push({ process: current.id, start: startTime, end: endTime });
        
        time = endTime;
        current.completion = time;
        current.turnaround = current.completion - current.arrival;
        current.waiting = current.turnaround - current.burst;
        
        completed.push(current);
        remaining = remaining.filter(p => p.id !== current.id);
        stepNum++;
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
        contentData: { 
            "Mode": "Preemptive (Shortest Remaining Time First)",
            "Deskripsi": "CPU akan selalu memilih proses dengan sisa waktu (Remaining Time) terpendek.",
            "Aturan": "Proses bisa diinterupsi jika ada proses baru yang lebih pendek tiba."
        },
        summary: `Mode Preemptive aktif. CPU akan selalu waspada terhadap proses yang lebih singkat.`
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
                steps.push({
                    title: `Langkah ${stepNum}: Interupsi & Beralih`,
                    contentData: {
                        "Waktu": time,
                        "Proses Dihentikan": lastProcessId,
                        "Proses Baru": current.id,
                        "Alasan": `${current.id} memiliki sisa waktu lebih pendek (${current.remaining}).`
                    },
                    summary: `Tunggu dulu! ${current.id} datang dan lebih prioritas. CPU beralih tugas.`
                });
                stepNum++;
            } else {
                 steps.push({
                    title: `Langkah ${stepNum}: Eksekusi Dimulai`,
                    contentData: {
                        "Waktu": time,
                        "Proses Pertama": current.id,
                        "Sisa Waktu": current.remaining
                    },
                    summary: `Mesin menyala! ${current.id} menjadi proses pertama yang dieksekusi.`
                });
                stepNum++;
            }
            segmentStart = time;
            lastProcessId = current.id;
        }

        current.remaining--;
        time++;

        if (current.remaining === 0) {
            current.completion = time;
            current.turnaround = current.completion - current.arrival;
            current.waiting = current.turnaround - current.burst;
            completedCount++;
            gantt.push({ process: lastProcessId, start: segmentStart, end: time });
            
            steps.push({
                title: `Langkah ${stepNum}: ${current.id} Selesai`,
                contentData: {
                    "Waktu Selesai": time,
                    "Proses": current.id,
                    "Total Proses Selesai": `${completedCount} dari ${procs.length}`,
                },
                summary: `Misi tuntas! ${current.id} telah menyelesaikan tugasnya pada T=${time}.`
            });
            stepNum++;
            lastProcessId = null;
        }
    }
    
    return { processes: procs, gantt, steps };
}

function displayResults(result) {
    const { processes, gantt, steps } = result;
    
    let avgWT = processes.reduce((sum, p) => sum + p.waiting, 0) / processes.length;
    let avgTAT = processes.reduce((sum, p) => sum + p.turnaround, 0) / processes.length;
    
    const processColors = ['#D2B48C', '#A0522D', '#BC8F8F', '#CD853F', '#8B4513', '#D2691E', '#F4A460', '#DEB887', '#E6B0AA', '#B8860B'];
    const totalDuration = gantt.length > 0 ? gantt[gantt.length - 1].end - gantt[0].start : 0;
    const timelineStart = gantt.length > 0 ? gantt[0].start : 0;

    const ganttChartHTML = `
        <div class="results-section gantt-wrapper-new">
            <h3 class="gantt-title-new">
                 <svg width="24" height="24" viewBox="0 0 24 24" style="margin-right: 10px; vertical-align: middle;" fill="currentColor">
                    <rect x="4" y="14" width="4" height="6" rx="1"/>
                    <rect x="10" y="8" width="4" height="12" rx="1"/>
                    <rect x="16" y="4" width="4" height="16" rx="1"/>
                </svg>
                Gantt Chart
            </h3>
            <div class="gantt-chart-container-new">
                <div class="gantt-bar-new">
                    ${gantt.map(g => {
                        const duration = g.end - g.start;
                        const percentageWidth = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
                        const processIndex = parseInt(g.process.substring(1)) - 1;
                        const color = processColors[processIndex % processColors.length];
                        return `<div class="gantt-segment-new" style="width: ${percentageWidth}%; background-color: ${color};">
                                    ${g.process}
                                </div>`;
                    }).join('')}
                </div>
                <div class="gantt-timescale-new">
                     <div class="time-point" style="left: 0%;">
                        <span>${timelineStart}</span>
                    </div>
                    ${gantt.map(g => {
                        const endPosition = totalDuration > 0 ? ((g.end - timelineStart) / totalDuration) * 100 : 0;
                        return `<div class="time-point" style="left: ${endPosition}%;">
                                    <span>${g.end}</span>
                                </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    const stepsHTML = `
        <div class="results-section steps-container">
            <h3>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                    <path d="M12 20V4M5 12l7-7 7 7"/>
                </svg>
                Langkah-langkah Penyelesaian
            </h3>
            <div class="steps-timeline">
                ${steps.map((step, index) => {
                    let icon = '⚡';
                    if (step.title.includes('Urutkan') || step.title.includes('Tiba')) icon = '📊';
                    else if (step.title.includes('Beralih') || step.title.includes('Interupsi')) icon = '🔄';
                    else if (step.title.includes('Selesai')) icon = '✅';
                    else if (step.title.includes('Menunggu') || step.title.includes('Menganggur')) icon = '⏳';
                    else if (step.title.includes('Kalkulasi')) icon = '📈';
                    else if (step.title.includes('Inisialisasi') || step.title.includes('Dimulai')) icon = '🎯';
                    
                    const contentDetails = Object.entries(step.contentData)
                        .map(([key, value]) => `
                            <div class="detail-item">
                                <span class="detail-label">${key}</span>
                                <strong class="detail-value">${value}</strong>
                            </div>
                        `).join('');

                    return `
                        <div class="step-timeline-item">
                            <div class="step-icon">${icon}</div>
                            <div class="step-content">
                                <div class="step-header-timeline">
                                    <h4>${step.title}</h4>
                                </div>
                                <div class="step-details-timeline">
                                    ${contentDetails}
                                </div>
                                <div class="step-summary-timeline">
                                    <p>${step.summary}</p>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    let sortedProcesses;
    if (currentMode === 'noArrival') {
        sortedProcesses = [...processes].sort((a, b) => a.burst - b.burst);
    } else {
        sortedProcesses = [...processes].sort((a, b) => a.originalIndex - b.originalIndex);
    }

    let tatCalcStrings = sortedProcesses.map(p => p.turnaround).join(' + ');
    let wtCalcStrings = sortedProcesses.map(p => p.waiting).join(' + ');

    const calculationHTML = `
        <div class="results-section calculation-details">
            <h3>🧮 Perhitungan Detail</h3>
            <div class="calculation-grid">
                ${sortedProcesses.map(p => `
                    <div class="calc-block">
                        <h4>${p.id}</h4>
                        <div class="calc-group">
                            <div class="calc-formula">TAT = CT - AT</div>
                            <p class="calc-result">${p.turnaround} = ${p.completion} - ${p.arrival}</p>
                        </div>
                        <div class="calc-group">
                            <div class="calc-formula">WT = TAT - BT</div>
                            <p class="calc-result">${p.waiting} = ${p.turnaround} - ${p.burst}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="calculation-summary">
                <div class="calc-block summary-block">
                    <h4>Rata-rata Turnaround Time</h4>
                    <div class="calc-formula">Avg TAT = (Σ TAT) / N</div>
                    <p class="calc-result">${avgTAT.toFixed(2)} = (${tatCalcStrings}) / ${processes.length}</p>
                </div>
                <div class="calc-block summary-block">
                    <h4>Rata-rata Waiting Time</h4>
                    <div class="calc-formula">Avg WT = (Σ WT) / N</div>
                    <p class="calc-result">${avgWT.toFixed(2)} = (${wtCalcStrings}) / ${processes.length}</p>
                </div>
            </div>
        </div>
    `;
    
    let html = `
        ${stepsHTML}
        ${ganttChartHTML}
        ${calculationHTML}
        <div class="results-section">
            <h3>📋 Tabel Hasil Lengkap</h3>
            <table>
                <thead>
                    <tr>
                        <th>Proses</th>
                        <th>Arrival Time</th>
                        <th>Burst Time</th>
                        <th>Completion Time</th>
                        <th>Turnaround Time</th>
                        <th>Waiting Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedProcesses.map(p => `
                        <tr>
                            <td><strong class="process-id">${p.id}</strong></td>
                            <td>${p.arrival}</td>
                            <td>${p.burst}</td>
                            <td>${p.completion}</td>
                            <td><span class="metric-value">${p.turnaround}</span></td>
                            <td><span class="metric-value ${p.waiting > 0 ? 'waiting-high' : ''}">${p.waiting}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="summary">
            <h3>✨ Ringkasan Akhir</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">⏱ Rata-rata Waiting Time</div>
                    <div class="summary-value">${avgWT.toFixed(2)}</div>
                    <div class="summary-desc">Waktu tunggu rata-rata proses</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">🔄 Rata-rata Turnaround Time</div>
                    <div class="summary-value">${avgTAT.toFixed(2)}</div>
                    <div class="summary-desc">Waktu putar rata-rata proses</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">⏰ Total Waktu Eksekusi</div>
                    <div class="summary-value">${gantt.length > 0 ? gantt[gantt.length-1].end : 0}</div>
                    <div class="summary-desc">Waktu total yang dibutuhkan</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">📊 Jumlah Proses</div>
                    <div class="summary-value">${processes.length}</div>
                    <div class="summary-desc">Total proses yang dijadwalkan</div>
                </div>
            </div>
        </div>
    `;

    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

// Theme switcher logic
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

const applyTheme = (theme) => {
    body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
};

themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
});

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    generateInputs();
});
