import React, { useState, useEffect } from 'react';

export default function SJFScheduler() {
  const [currentMode, setCurrentMode] = useState('noArrival');
  const [numProcesses, setNumProcesses] = useState(4);
  const [processes, setProcesses] = useState([
    { burst: 8, arrival: 9 },
    { burst: 10, arrival: 18 },
    { burst: 6, arrival: 2 },
    { burst: 3, arrival: 15 }
  ]);
  const [results, setResults] = useState(null);
  const [showArrival, setShowArrival] = useState(false);

  const selectMode = (mode) => {
    setCurrentMode(mode);
    setShowArrival(mode !== 'noArrival');
    setResults(null);
  };

  const updateProcess = (index, field, value) => {
    const newProcesses = [...processes];
    newProcesses[index][field] = parseInt(value) || 0;
    setProcesses(newProcesses);
  };

  const updateNumProcesses = (num) => {
    setNumProcesses(num);
    const newProcesses = [...processes];
    while (newProcesses.length < num) {
      newProcesses.push({ burst: 5, arrival: newProcesses.length });
    }
    setProcesses(newProcesses.slice(0, num));
  };

  const calculateNoArrival = (procs) => {
    let steps = [];
    let procsData = procs.map((p, i) => ({
      ...p,
      id: `P${i + 1}`,
      arrival: 0,
      remaining: p.burst,
      index: i
    }));

    // Sort by burst time for no arrival time mode
    procsData.sort((a, b) => a.burst - b.burst);

    steps.push({
      title: "Langkah 1: Urutkan Proses Berdasarkan Burst Time",
      contentData: { "Deskripsi": `Proses diurutkan berdasarkan Burst Time (BT) dari terkecil ke terbesar karena tidak ada Arrival Time.` },
      summary: `Urutan eksekusi: ${procsData.map(p => p.id).join(', ')}.`
    });

    let time = 0;
    let completed = [];
    let gantt = [];
    let stepNum = 2;

    procsData.forEach(current => {
      gantt.push({ process: current.id, start: time, end: time + current.burst });
      
      steps.push({
        title: `Langkah ${stepNum++}: Eksekusi ${current.id}`,
        contentData: {
          "Waktu Sekarang": time,
          "Proses": current.id,
          "Burst Time": current.burst,
        },
        summary: `Proses ${current.id} dieksekusi dari T=${time} hingga T=${time + current.burst}.`
      });

      time += current.burst;
      current.completion = time;
      current.turnaround = current.completion - current.arrival;
      current.waiting = current.turnaround - current.burst;
      
      completed.push(current);
    });

    return { processes: completed, gantt, steps };
  };

  const calculateNonPreemptive = (procs) => {
    let steps = [];
    let sortedByArrival = procs.map((p, i) => ({
      ...p,
      id: `P${i + 1}`,
      remaining: p.burst,
      index: i
    })).sort((a, b) => a.arrival - b.arrival);

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
  };

  const calculatePreemptive = (procs) => {
    let steps = [];
    let time = 0;
    let completedCount = 0;
    let gantt = [];
    let procsData = procs.map((p, i) => ({
      ...p,
      id: `P${i + 1}`,
      remaining: p.burst,
      index: i
    }));

    steps.push({
      title: "Langkah 1: Inisialisasi SRTF",
      contentData: { "Mode": "Preemptive (SRTF)" },
      summary: `CPU akan selalu memilih proses dengan sisa waktu (Remaining Time) terpendek di antara proses yang telah tiba.`
    });

    let lastProcessId = null;
    let segmentStart = 0;
    let stepNum = 2;

    while (completedCount < procsData.length) {
      let available = procsData.filter(p => p.arrival <= time && p.remaining > 0);
      
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
    return { processes: procsData, gantt, steps };
  };

  const calculate = () => {
    let result;
    if (currentMode === 'noArrival') {
      result = calculateNoArrival(processes.slice(0, numProcesses));
    } else if (currentMode === 'preemptive') {
      result = calculatePreemptive(processes.slice(0, numProcesses));
    } else {
      result = calculateNonPreemptive(processes.slice(0, numProcesses));
    }
    setResults(result);
  };

  const processColors = ['#A0522D', '#CD853F', '#D2B48C', '#BC8F8F', '#F4A460', '#8B4513', '#D2691E', '#B87333', '#C4A484', '#966F33'];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px', background: 'linear-gradient(135deg, #FFF8DC 0%, #F5DEB3 100%)', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 40px rgba(139,69,19,0.1)' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', color: '#8B4513', marginBottom: '10px', textAlign: 'center' }}>
          🎯 SJF Scheduler Calculator
        </h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>Shortest Job First - CPU Scheduling Algorithm</p>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#8B4513' }}>Mode Penjadwalan:</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { id: 'noArrival', label: '🔵 SJF - Tanpa Arrival Time' },
              { id: 'withArrival', label: '🟢 SJF - Dengan Arrival Time' },
              { id: 'nonPreemptive', label: '🟡 SJF Non-Preemptive' },
              { id: 'preemptive', label: '🟠 SJF Preemptive (SRTF)' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => selectMode(mode.id)}
                style={{
                  flex: '1',
                  minWidth: '180px',
                  padding: '12px 20px',
                  border: 'none',
                  borderRadius: '10px',
                  background: currentMode === mode.id ? '#8B4513' : '#f0f0f0',
                  color: currentMode === mode.id ? 'white' : '#333',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#8B4513' }}>Jumlah Proses:</label>
          <input
            type="number"
            min="2"
            max="10"
            value={numProcesses}
            onChange={(e) => updateNumProcesses(parseInt(e.target.value) || 2)}
            style={{ width: '100%', padding: '12px', border: '2px solid #D2B48C', borderRadius: '10px', fontSize: '16px' }}
          />
        </div>

        <div style={{ marginBottom: '25px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: showArrival ? '100px 1fr 1fr' : '100px 1fr', gap: '10px', background: '#8B4513', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 'bold', marginBottom: '10px' }}>
            <div>Proses</div>
            <div>Burst Time</div>
            {showArrival && <div>Arrival Time</div>}
          </div>
          {processes.slice(0, numProcesses).map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: showArrival ? '100px 1fr 1fr' : '100px 1fr', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              <div style={{ fontWeight: '600', color: '#8B4513', fontSize: '18px' }}>P{i + 1}</div>
              <input
                type="number"
                min="1"
                value={p.burst}
                onChange={(e) => updateProcess(i, 'burst', e.target.value)}
                style={{ padding: '10px', border: '2px solid #D2B48C', borderRadius: '8px', fontSize: '16px' }}
              />
              {showArrival && (
                <input
                  type="number"
                  min="0"
                  value={p.arrival}
                  onChange={(e) => updateProcess(i, 'arrival', e.target.value)}
                  style={{ padding: '10px', border: '2px solid #D2B48C', borderRadius: '8px', fontSize: '16px' }}
                />
              )}
            </div>
          ))}
        </div>

        <button
          onClick={calculate}
          style={{
            width: '100%',
            padding: '15px',
            background: 'linear-gradient(135deg, #A0522D 0%, #8B4513 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            boxShadow: '0 4px 15px rgba(139,69,19,0.3)'
          }}
          onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        >
          🚀 Hitung SJF Scheduling
        </button>
      </div>

      {results && (
        <div style={{ marginTop: '30px', background: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 40px rgba(139,69,19,0.1)' }}>
          {/* Steps */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#8B4513', marginBottom: '20px' }}>📝 Langkah-langkah Penyelesaian</h3>
            {results.steps.map((step, index) => (
              <StepAccordion key={index} step={step} index={index} />
            ))}
          </div>

          {/* Gantt Chart */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#8B4513', marginBottom: '20px' }}>📊 Gantt Chart</h3>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', height: '60px' }}>
                {results.gantt.map((g, i) => {
                  const duration = g.end - g.start;
                  const totalDuration = results.gantt[results.gantt.length - 1].end;
                  const width = (duration / totalDuration) * 100;
                  const processIndex = parseInt(g.process.substring(1)) - 1;
                  const color = processColors[processIndex % processColors.length];
                  return (
                    <div key={i} style={{ width: `${width}%`, background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '1px solid white' }}>
                      {g.process}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex' }}>
                <div style={{ flexBasis: '0' }}>{results.gantt[0]?.start || 0}</div>
                {results.gantt.map((g, i) => {
                  const duration = g.end - g.start;
                  const totalDuration = results.gantt[results.gantt.length - 1].end;
                  const width = (duration / totalDuration) * 100;
                  return (
                    <div key={i} style={{ width: `${width}%`, textAlign: 'right' }}>{g.end}</div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Calculations */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#8B4513', marginBottom: '20px' }}>🧮 Menghitung dengan Rumus</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              {results.processes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map(p => (
                <div key={p.id} style={{ background: '#FFF8DC', padding: '20px', borderRadius: '12px', border: '2px solid #D2B48C' }}>
                  <h4 style={{ color: '#8B4513', marginBottom: '15px' }}>Proses {p.id}</h4>
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ background: '#8B4513', color: 'white', padding: '5px 10px', borderRadius: '5px', marginBottom: '5px', fontSize: '14px' }}>TAT = CT - AT</div>
                    <p style={{ margin: '5px 0' }}>{p.turnaround} = {p.completion} - {p.arrival}</p>
                  </div>
                  <div>
                    <div style={{ background: '#8B4513', color: 'white', padding: '5px 10px', borderRadius: '5px', marginBottom: '5px', fontSize: '14px' }}>WT = TAT - BT</div>
                    <p style={{ margin: '5px 0' }}>{p.waiting} = {p.turnaround} - {p.burst}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div style={{ background: '#E8F5E9', padding: '20px', borderRadius: '12px', border: '2px solid #81C784' }}>
                <h4 style={{ color: '#2E7D32', marginBottom: '15px' }}>Rata-rata Turnaround Time</h4>
                <div style={{ background: '#2E7D32', color: 'white', padding: '5px 10px', borderRadius: '5px', marginBottom: '10px' }}>Avg TAT = (Σ TAT) / N</div>
                <p>{(results.processes.reduce((sum, p) => sum + p.turnaround, 0) / results.processes.length).toFixed(2)} = ({results.processes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map(p => p.turnaround).join(' + ')}) / {results.processes.length}</p>
              </div>
              <div style={{ background: '#FFF3E0', padding: '20px', borderRadius: '12px', border: '2px solid #FFB74D' }}>
                <h4 style={{ color: '#E65100', marginBottom: '15px' }}>Rata-rata Waiting Time</h4>
                <div style={{ background: '#E65100', color: 'white', padding: '5px 10px', borderRadius: '5px', marginBottom: '10px' }}>Avg WT = (Σ WT) / N</div>
                <p>{(results.processes.reduce((sum, p) => sum + p.waiting, 0) / results.processes.length).toFixed(2)} = ({results.processes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map(p => p.waiting).join(' + ')}) / {results.processes.length}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#8B4513', marginBottom: '20px' }}>📋 Tabel Hasil</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#8B4513', color: 'white' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Proses</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Arrival Time</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Burst Time</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Completion Time</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Turnaround Time</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Waiting Time</th>
                </tr>
              </thead>
              <tbody>
                {results.processes
                  .sort((a, b) => {
                    // Untuk mode tanpa arrival time, sort by burst time
                    if (currentMode === 'noArrival') {
                      return a.burst - b.burst;
                    }
                    // Untuk mode lainnya, sort by arrival time (urutan kedatangan)
                    return a.arrival - b.arrival || a.id.localeCompare(b.id, undefined, { numeric: true });
                  })
                  .map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? '#FFF8DC' : 'white' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.id}</td>
                      <td style={{ padding: '12px' }}>{p.arrival}</td>
                      <td style={{ padding: '12px' }}>{p.burst}</td>
                      <td style={{ padding: '12px' }}>{p.completion}</td>
                      <td style={{ padding: '12px' }}>{p.turnaround}</td>
                      <td style={{ padding: '12px' }}>{p.waiting}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', background: 'linear-gradient(135deg, #FFE4B5 0%, #F5DEB3 100%)', padding: '30px', borderRadius: '15px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>⏱ Average Waiting Time</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8B4513' }}>
                {(results.processes.reduce((sum, p) => sum + p.waiting, 0) / results.processes.length).toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>🔄 Average Turnaround Time</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8B4513' }}>
                {(results.processes.reduce((sum, p) => sum + p.turnaround, 0) / results.processes.length).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepAccordion({ step, index }) {
  const [isOpen, setIsOpen] = useState(index === 0);

  const sortIcon = (
    <svg style={{ width: '24px', height: '24px', marginRight: '10px' }} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
    </svg>
  );

  const cpuIcon = (
    <svg style={{ width: '24px', height: '24px', marginRight: '10px' }} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m3.75 3.75h-1.5m-15 3.75h1.5m15 0h1.5m-15 3.75h1.5m15 0h1.5" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div style={{ marginBottom: '15px', border: '2px solid #D2B48C', borderRadius: '12px', overflow: 'hidden' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: '#FFF8DC',
          padding: '15px 20px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: '600',
          color: '#8B4513'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {index === 0 ? sortIcon : cpuIcon}
          <span>{step.title}</span>
        </div>
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s' }}>▼</span>
      </div>
      {isOpen && (
        <div style={{ padding: '20px', background: 'white' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
            {Object.entries(step.contentData).map(([key, value]) => (
              <div key={key} style={{ background: '#F5F5F5', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>{key}</div>
                <div style={{ fontWeight: 'bold', color: '#333' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#E8F5E9', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #4CAF50' }}>
            <p style={{ margin: 0, color: '#2E7D32' }}>{step.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
      }
