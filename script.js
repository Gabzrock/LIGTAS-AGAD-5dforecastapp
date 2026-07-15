// ==========================================
// --- CONFIGURATION ---
// ==========================================
const API_KEY = '17a13e02b8ff0aeddd7167e2ea25c430'; 

const provinces = [
    { name: "IPB, UP Los Baños, Laguna ", lat: 14.1647, lon: 121.2419},
    { name: "National Art Center (NAC), UP Los Baños, Laguna", lat: 14.1636, lon: 121.2158},
    { name: "Bitin, Bay, Laguna", lat: 14.10834, lon: 121.2247},
    { name: "UP-Landgrant, Siniloan, Laguna", lat: 14.4903, lon: 121.5145},
    { name: "Batangas city, Batangas", lat: 13.7626,lon: 121.0580},
    { name: "Lobo, Batangas", lat: 13.6417, lon: 121.1934},
    { name: "Baguio City", lat: 16.4023, lon: 120.5960},
    { name: "Mankayan, Benguet", lat: 16.8228, lon: 120.8178},
    { name: "Buguias, Benguet", lat: 16.7883, lon: 120.8329},
    { name: "Bokod, Benguet", lat: 16.5497, lon: 120.8381},
    { name: "Tublay, Benguet", lat: 16.4767, lon: 120.6598},
    { name: "Itogon, Benguet", lat: 16.4012, lon: 120.6468},
    { name: "Puerto Princesa, Palawan", lat: 9.7392, lon: 118.7353},
    { name: "Legazpi, Albay", lat: 13.1391, lon: 123.7438},
    { name: "Northern, Samar", lat: 12.5087, lon: 124.6645},
    { name: "Iriga city, Camarines Sur", lat: 13.5379, lon: 123.4458},
    { name: "Pasil, Kalinga", lat: 17.3963, lon: 121.1688}

];

const els = {
    select: document.getElementById('province-select'),
    title: document.getElementById('location-title'),
    coords: document.getElementById('coords-display'),
    grid: document.getElementById('forecast-grid'),
    tbody: document.getElementById('table-body')
};

let map, markersLayer, userGpsLayer, rainChartInstance = null;
const svgCache = {}; // Caches raw SVG strings for instant rendering

function init() {
    provinces.forEach((p, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = p.name;
        els.select.appendChild(opt);
    });

    els.select.addEventListener('change', () => updateDashboard(els.select.value));

    map = L.map('map', { zoomControl: false }).setView([12.8, 121.8], 5);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 18, 
        attribution: '&copy; OpenStreetMap' 
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
    userGpsLayer = L.layerGroup().addTo(map);
    loadAllData();
}

// ==========================================
// --- THEME TOGGLE ENGINE ---
// ==========================================
function toggleTheme() {
    const isNight = document.body.classList.toggle('night-mode');
    const btn = document.getElementById('btn-theme');
    btn.innerHTML = isNight ? '☀️ Day Mode' : '🌙 Night Mode';

    if (rainChartInstance) {
        const textColor = isNight ? '#94a3b8' : '#475569';
        const gridColor = isNight ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';
        
        rainChartInstance.options.scales.x.ticks.color = textColor;
        rainChartInstance.options.scales.y.ticks.color = textColor;
        rainChartInstance.options.scales.y.title.color = textColor;
        rainChartInstance.options.scales.y.grid.color = gridColor;
        rainChartInstance.update();
    }
}

// ==========================================
// --- LIVE GPS ENGINE ---
// ==========================================
function findUserLocation() {
    const gpsBtn = document.getElementById('btn-gps');
    
    if (!navigator.geolocation) {
        alert("Your browser does not support HTML5 Geolocation.");
        return;
    }

    gpsBtn.innerHTML = "📡 Locating...";
    gpsBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            userGpsLayer.clearLayers();
            const pulseIcon = L.divIcon({
                className: 'gps-pulse-marker',
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });
            
            const gpsMarker = L.marker([lat, lon], { icon: pulseIcon }).addTo(userGpsLayer);
            gpsMarker.bindPopup("<b>📍 Your Current Location</b>").openPopup();

            map.flyTo([lat, lon], 11, { animate: true, duration: 1.5 });

            els.title.textContent = "📍 My GPS Location";
            els.coords.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            els.select.value = ""; 
            els.grid.innerHTML = '<div class="loading-msg">Fetching local GPS weather...</div>';

            try {
                const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
                const data = await res.json();
                renderData(data.list);
            } catch (err) {
                els.grid.innerHTML = '<div class="loading-msg" style="color:red">Failed to fetch GPS weather data.</div>';
            } finally {
                gpsBtn.innerHTML = "📍 Find My Location";
                gpsBtn.disabled = false;
            }
        },
        (error) => {
            console.error("GPS Error:", error);
            alert("Unable to retrieve GPS location. Please check browser location permissions.");
            gpsBtn.innerHTML = "📍 Find My Location";
            gpsBtn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

async function loadAllData() {
    const promises = provinces.map(p => 
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${p.lat}&lon=${p.lon}&appid=${API_KEY}&units=metric`)
        .then(r => r.json())
        .then(data => ({ ...p, list: data.list }))
        .catch(() => null)
    );

    try {
        const results = (await Promise.all(promises)).filter(r => r && r.list);
        markersLayer.clearLayers();
        
        results.forEach((res) => {
            const totalRain = res.list.reduce((acc, curr) => acc + (curr.rain?.['3h'] || 0), 0);
            
            let color = 'transparent'; 
            if (totalRain > 30) color = 'red'; 
            else if (totalRain > 15) color = 'orange'; 
            else if (totalRain > 7.5) color = 'yellow'; 

            const marker = L.circle([res.lat, res.lon], {
                color: color, fillColor: color, fillOpacity: 0.6,
                radius: 20000, weight: 1
            }).addTo(markersLayer);

            marker.bindPopup(`<b>${res.name}</b><br>6-day Rainfall Accumulation: ${Math.round(totalRain)}mm`);
            
            marker.on('click', () => {
                userGpsLayer.clearLayers(); 
                const originalIdx = provinces.findIndex(p => p.name === res.name);
                els.select.value = originalIdx;
                updateDashboard(originalIdx, res.list);
            });
            
            provinces[provinces.findIndex(p => p.name === res.name)].cachedData = res.list;
        });

        if(results.length > 0) updateDashboard(0);

    } catch (e) {
        console.error(e);
        els.grid.innerHTML = '<div class="loading-msg" style="color:red">Error loading API. Check Key.</div>';
    }
}

function updateDashboard(idx, directData = null) {
    if (idx === "") return; 
    userGpsLayer.clearLayers();

    const prov = provinces[idx];
    els.title.textContent = prov.name;
    els.coords.textContent = `${prov.lat.toFixed(2)}, ${prov.lon.toFixed(2)}`;

    let data = directData || prov.cachedData;

    if (data) {
        renderData(data);
    } else {
        els.grid.innerHTML = '<div class="loading-msg">Fetching data...</div>';
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${prov.lat}&lon=${prov.lon}&appid=${API_KEY}&units=metric`)
            .then(r => r.json())
            .then(d => {
                prov.cachedData = d.list;
                renderData(d.list);
            });
    }
    
    map.setView([prov.lat, prov.lon], 9, { animate: true });
}

// ==========================================
// --- INLINE SVG FETCHER ENGINE ---
// ==========================================
async function getInlineSVG(iconName, customClass = "") {
    if (!svgCache[iconName]) {
        try {
            const res = await fetch(`https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/${iconName}.svg`);
            let svgText = await res.text();
            // Remove hardcoded width/height attributes to allow CSS scaling
            svgText = svgText.replace(/width="[^"]*"/g, '').replace(/height="[^"]*"/g, '');
            svgCache[iconName] = svgText;
        } catch (e) {
            return `<span style="font-size:32px;">⛅</span>`; // Fallback native emoji
        }
    }
    // Inject custom class into the <svg> root tag
    return svgCache[iconName].replace('<svg ', `<svg class="${customClass}" style="width:100%; height:100%;" `);
}

async function renderData(list) {
    const days = {};
    list.forEach(item => {
        const dateStr = new Date(item.dt * 1000).toDateString();
        if (!days[dateStr]) {
            days[dateStr] = {
                date: new Date(item.dt * 1000),
                icons: {},
                pop: 0, rain: 0,
                min: 100, max: -100,
                hum: 0, wind: 0, count: 0
            };
        }
        const d = days[dateStr];
        const icon = item.weather[0].icon.replace('n','d');
        d.icons[icon] = (d.icons[icon] || 0) + 1;
        d.pop = Math.max(d.pop, item.pop);
        d.rain += (item.rain?.['3h'] || 0);
        d.min = Math.min(d.min, item.main.temp_min);
        d.max = Math.max(d.max, item.main.temp_max);
        d.hum += item.main.humidity;
        d.wind += item.wind.speed;
        d.count++;
    });

    const sortedDays = Object.values(days).slice(0, 6);

    const svgMap = {
        '01d': 'clear-day', '02d': 'partly-cloudy-day', '03d': 'cloudy',
        '04d': 'overcast', '09d': 'rain', '10d': 'partly-cloudy-day-rain',
        '11d': 'thunderstorms', '13d': 'snow', '50d': 'mist'
    };

    // Render Grid
    els.grid.innerHTML = '';
    for (const d of sortedDays) {
        const icon = Object.keys(d.icons).reduce((a, b) => d.icons[a] > d.icons[b] ? a : b);
        const cleanName = svgMap[icon] || 'cloudy';
        const inlineSvgMarkup = await getInlineSVG(cleanName, "dc-icon");

        let desc = "Cloudy";
        if(icon.includes('10') || icon.includes('09')) desc = "Rain";
        else if(icon.includes('01')) desc = "Sunny";
        else if(icon.includes('02')) desc = "Partly Cloudy";
        else if(icon.includes('11')) desc = "Thunderstorm";

        const rainTxt = d.pop > 0 ? `${Math.round(d.pop*100)}% (${d.rain < 1 ? '<1' : Math.round(d.rain)}mm)` : 'No Rain';

        const card = document.createElement('div');
        card.className = 'day-card';
        card.innerHTML = `
            <div class="dc-day">${d.date.toLocaleDateString('en-US',{weekday:'short'})}</div>
            <div class="dc-date">${d.date.getDate()} ${d.date.toLocaleDateString('en-US',{month:'short'})}</div>
            <div style="width:68px; height:68px; margin: 6px 0 10px 0; display:flex; align-items:center; justify-content:center;">
                ${inlineSvgMarkup}
            </div>
            <div class="dc-desc">${desc}</div>
            <div class="dc-rain">${rainTxt}</div>
        `;
        els.grid.appendChild(card);
    }

    // Render Table
    els.tbody.innerHTML = '';
    for (const d of sortedDays) {
        const icon = Object.keys(d.icons).reduce((a, b) => d.icons[a] > d.icons[b] ? a : b);
        const cleanName = svgMap[icon] || 'cloudy';
        const inlineSvgMarkup = await getInlineSVG(cleanName);

        let fullDesc = "Cloudy";
        if(icon.includes('01')) fullDesc = "Clear Sky";
        else if(icon.includes('02')) fullDesc = "Partly Cloudy";
        else if(icon.includes('10')) fullDesc = "Light Rain";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${d.date.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})}</b></td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:28px; height:28px; display:inline-block;">${inlineSvgMarkup}</div>
                    <span>${fullDesc}</span>
                </div>
            </td>
            <td class="hide-mobile">${Math.round(d.min)}° - ${Math.round(d.max)}°C</td>
            <td class="hide-mobile">${Math.round(d.hum/d.count)}%</td>
            <td class="hide-mobile">${(d.wind/d.count).toFixed(1)} m/s</td>
            <td>${Math.round(d.pop*100)}%</td>
            <td class="${d.rain > 0 ? 'highlight-rain' : ''}">${d.rain.toFixed(1)} mm</td>
        `;
        els.tbody.appendChild(tr);
    }

    const chartLabels = sortedDays.map(d => d.date.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'}));
    const chartValues = sortedDays.map(d => Number(d.rain.toFixed(1)));
    renderRainfallChart(chartLabels, chartValues);
}

// ==========================================
// --- INTERACTIVE CHART ENGINE ---
// ==========================================
function renderRainfallChart(labels, dataPoints) {
    const canvasEl = document.getElementById('rainfallChart');
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');

    const isNight = document.body.classList.contains('night-mode');
    const textColor = isNight ? '#94a3b8' : '#475569';
    const gridColor = isNight ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';

    const dynamicBackgrounds = dataPoints.map(val => {
        if (val > 30) return 'rgba(239, 68, 68, 0.85)';      
        if (val > 15) return 'rgba(249, 115, 22, 0.85)';     
        if (val > 7.5) return 'rgba(234, 179, 8, 0.85)';     
        return 'rgba(14, 165, 233, 0.85)';                   
    });

    const dynamicBorders = dataPoints.map(val => {
        if (val > 30) return '#dc2626';
        if (val > 15) return '#ea580c';
        if (val > 7.5) return '#ca8a04';
        return '#0284c7';
    });

    if (rainChartInstance) rainChartInstance.destroy();

    rainChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Accumulated Rain (mm)',
                data: dataPoints,
                backgroundColor: dynamicBackgrounds,
                borderColor: dynamicBorders,
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 10,
                    callbacks: { label: (c) => ` Total Rain: ${c.raw} mm` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Rainfall (mm)', color: textColor, font: {weight: 'bold'} },
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: textColor, font: {weight: '600'} },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// --- SCREENSHOT MODE EXPORT ENGINE ---
// ==========================================
async function exportView(format) {
    const targetEl = document.getElementById('weather-section');
    const buttons = document.querySelector('.export-actions');
    const grid = document.getElementById('forecast-grid');
    const weatherRow = document.querySelector('.weather-row');

    if(buttons) buttons.style.visibility = 'hidden'; 
    const originalGridOverflow = grid.style.overflow;
    const originalRowHeight = weatherRow.style.height;
    
    grid.style.overflow = 'visible';
    grid.style.flexWrap = 'wrap';
    weatherRow.style.height = 'auto';

    const creditDiv = document.createElement('div');
    creditDiv.id = 'temp-export-credits';
    creditDiv.style.cssText = 'margin-top: 25px; padding-top: 15px; border-top: 1px dashed var(--border); font-size: 11px; color: var(--text-muted); text-align: center; font-style: italic; letter-spacing: 0.3px;';
    creditDiv.innerHTML = 'This report is generated by <strong>LIGTAS-AGAD RILEWS DOST</strong> project Funded, implemented by <strong>SESAM</strong>';
    targetEl.appendChild(creditDiv);

    map.invalidateSize();
    await new Promise(resolve => setTimeout(resolve, 800)); // Give browser layout reflow time

    const locationName = document.getElementById('location-title').textContent.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `ligtas_agad_${locationName || 'report'}`;

    try {
        if (format === 'pdf') {
            const opt = {
              margin:       10,
              filename:     `${fileName}.pdf`,
              image:        { type: 'jpeg', quality: 0.98 },
              html2canvas:  { scale: 2, useCORS: true, logging: false },
              jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            await html2pdf().set(opt).from(targetEl).save();
        } 
        else if (format === 'image') {
            const isNight = document.body.classList.contains('night-mode');
            const canvas = await html2canvas(targetEl, {
                scale: 2,               
                useCORS: true,          
                scrollY: -window.scrollY, 
                backgroundColor: isNight ? '#0f172a' : '#ffffff'
            });

            const imageURI = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            link.href = imageURI;
            link.click();
        } 
    } catch (error) {
        console.error("Export failed:", error);
        alert("Notice: Export blocked by browser security. Ensure you are running on a local development server.");
    } finally {
        const injectedCredit = document.getElementById('temp-export-credits');
        if(injectedCredit) targetEl.removeChild(injectedCredit);

        grid.style.overflow = originalGridOverflow;
        grid.style.flexWrap = 'nowrap';
        weatherRow.style.height = originalRowHeight;
        if(buttons) buttons.style.visibility = 'visible';
        map.invalidateSize();
    }
}

init();
