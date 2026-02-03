    // --- CONFIGURATION ---
    // IMPORTANT: REPLACE THIS WITH YOUR API KEY
    const API_KEY = '17a13e02b8ff0aeddd7167e2ea25c430'; 

const provinces = [
        { name: "IPB, UP Los Baños, Laguna ", lat: 14.1647, lon: 121.2419},
        { name: "National Art Center (NAC), UP Los Baños, Laguna", lat: 14.1636, lon: 121.2158},
        { name: "Bitin, Bay, Laguna", lat: 14.10834, lon: 121.2247},
        { name: "UP-Landgrant, Siniloan, Laguna", lat: 14.4903, lon: 121.5145},
        { name: "Metro Manila", lat: 14.5995, lon: 120.9842},
        { name: "Cebu City", lat: 10.3157, lon: 123.8854},
        { name: "Davao City", lat: 7.1907, lon: 125.4553},
        { name: "Iloilo City", lat: 10.7202, lon: 122.5621},
        { name: "Baguio City", lat: 16.4023, lon: 120.5960},
        { name: "Mankayan, Benguet", lat: 16.8228, lon: 120.8178},
        { name: "Buguias, Benguet", lat: 16.7883, lon: 120.8329},
        { name: "Bokod, Benguet", lat: 16.5497, lon: 120.8381},
        { name: "Tublay, Benguet", lat: 16.4767, lon: 120.6598},
        { name: "Itogon, Benguet", lat: 16.4012, lon: 120.6468},
        { name: "Puerto Princesa, Palawan", lat: 9.7392, lon: 118.7353},
        { name: "Tacloban, Leyte", lat: 11.2433, lon: 125.0047},
        { name: "Legazpi, Albay", lat: 13.1391, lon: 123.7438},
        { name: "Northern, Samar", lat: 12.5087, lon: 124.6645},
        { name: "Legazpi, Albay", lat: 13.1391, lon: 123.7438},
        { name: "Zamboanga City", lat: 6.9214, lon: 122.0790},
        { name: "Tuguegarao", lat: 17.6132, lon: 121.7270}
    ];

    // DOM References
    const els = {
        select: document.getElementById('province-select'),
        title: document.getElementById('location-title'),
        coords: document.getElementById('coords-display'),
        grid: document.getElementById('forecast-grid'),
        tbody: document.getElementById('table-body')
    };

    let map, markersLayer;

    // --- INITIALIZATION ---
    function init() {
        // 1. Populate Dropdown
        provinces.forEach((p, i) => {
            const opt = document.createElement('option');
            opt.value = i; opt.textContent = p.name;
            els.select.appendChild(opt);
        });

        // 2. Event Listener
        els.select.addEventListener('change', () => updateDashboard(els.select.value));

        // 3. Init Map
        map = L.map('map', { zoomControl: false }).setView([12.8, 121.8], 5);
        L.control.zoom({ position: 'topright' }).addTo(map);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            maxZoom: 18, 
            attribution: '&copy; OpenStreetMap' 
        }).addTo(map);

        markersLayer = L.layerGroup().addTo(map);

        // 4. Load Data
        loadAllData();
    }

    // --- DATA FETCHING ---
    async function loadAllData() {
        // Fetch data for ALL provinces to build map markers
        const promises = provinces.map(p => 
            fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${p.lat}&lon=${p.lon}&appid=${API_KEY}&units=metric`)
            .then(r => r.json())
            .then(data => ({ ...p, list: data.list }))
            .catch(() => null)
        );

        try {
            const results = (await Promise.all(promises)).filter(r => r && r.list);
            
            markersLayer.clearLayers();
            
            results.forEach((res, idx) => {
                // Calc Total Rain (5 Days)
                const totalRain = res.list.reduce((acc, curr) => acc + (curr.rain?.['3h'] || 0), 0);
                
                // Color Logic
                let color = 'transparent'; // Blue
                if (totalRain > 30) color = '#d9534f'; // Red
                else if (totalRain > 15) color = '#ff9800'; // Orange
                else if (totalRain > 7.5) color = 'yellow'; // Green-Yellow

                // 20km Radius Circle
                const marker = L.circle([res.lat, res.lon], {
                    color: color, fillColor: color, fillOpacity: 0.6,
                    radius: 20000, weight: 1
                }).addTo(markersLayer);

                marker.bindPopup(`<b>${res.name}</b><br>Rain Accumulation: ${Math.round(totalRain)}mm`);
                
                // Click to Select
                marker.on('click', () => {
                    const originalIdx = provinces.findIndex(p => p.name === res.name);
                    els.select.value = originalIdx;
                    updateDashboard(originalIdx, res.list);
                });
                
                // Cache data
                provinces[provinces.findIndex(p => p.name === res.name)].cachedData = res.list;
            });

            // Initial load of first province
            if(results.length > 0) updateDashboard(0);

        } catch (e) {
            console.error(e);
            els.grid.innerHTML = '<div class="loading-msg" style="color:red">Error loading API. Check Key.</div>';
        }
    }

    // --- DASHBOARD UPDATE ---
    function updateDashboard(idx, directData = null) {
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

    function renderData(list) {
        // Process Daily Aggregates
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

        // Render Grid
        els.grid.innerHTML = '';
        sortedDays.forEach(d => {
            const icon = Object.keys(d.icons).reduce((a, b) => d.icons[a] > d.icons[b] ? a : b);
            let desc = "Cloudy";
            if(icon.includes('10')) desc = "Rain";
            else if(icon.includes('01')) desc = "Sunny";
            else if(icon.includes('02')) desc = "Partly Cloudy";

            const rainTxt = d.pop > 0 
                ? `${Math.round(d.pop*100)}% (${d.rain < 1 ? '<1' : Math.round(d.rain)}mm)` 
                : 'No Rain';

            const card = document.createElement('div');
            card.className = 'day-card';
            card.innerHTML = `
                <div class="dc-day">${d.date.toLocaleDateString('en-US',{weekday:'short'})}</div>
                <div class="dc-date">${d.date.getDate()} ${d.date.toLocaleDateString('en-US',{month:'short'})}</div>
                <img src="https://openweathermap.org/img/wn/${icon}@2x.png" class="dc-icon">
                <div class="dc-desc">${desc}</div>
                <div class="dc-rain">${rainTxt}</div>
            `;
            els.grid.appendChild(card);
        });

        // Render Table
        els.tbody.innerHTML = '';
        sortedDays.forEach(d => {
            const icon = Object.keys(d.icons).reduce((a, b) => d.icons[a] > d.icons[b] ? a : b);
            let fullDesc = "Cloudy";
            if(icon.includes('01')) fullDesc = "Clear Sky";
            else if(icon.includes('02')) fullDesc = "Partly Cloudy";
            else if(icon.includes('10')) fullDesc = "Light Rain";

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${d.date.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})}</b></td>
                <td>${fullDesc}</td>
                <td class="hide-mobile">${Math.round(d.min)}° - ${Math.round(d.max)}°C</td>
                <td class="hide-mobile">${Math.round(d.hum/d.count)}%</td>
                <td class="hide-mobile">${(d.wind/d.count).toFixed(1)} m/s</td>
                <td>${Math.round(d.pop*100)}%</td>
                <td class="${d.rain > 0 ? 'highlight-rain' : ''}">${d.rain.toFixed(1)} mm</td>
            `;
            els.tbody.appendChild(tr);
        });
    }

    init();
