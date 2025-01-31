// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
             Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Add these variables at the top of your script with other global variables
let totalDistance = 0;
let lastPosition = null;
let distanceInitialized = false;

// Add this function to calculate initial distance
function initializeDistance(now) {
    if (distanceInitialized) return;
    
    totalDistance = 0;
    const { easterEveDate } = getEasterDates();
    const easterEveStart = new Date(easterEveDate);
    easterEveStart.setHours(10, 0, 0, 0);

    // If journey hasn't started, set to 0
    if (now < easterEveStart) {
        totalDistance = 0;
        distanceInitialized = true;
        return;
    }

    // Calculate distance up to current point
    let lastStopPos = [-27.1044228, -109.2489683]; // Easter Island starting point
    
    for (const stop of routeData) {
        const stopTime = new Date(stop.arrival * 1000);
        if (stopTime > now) break;
        
        const stopPos = [parseFloat(stop.Latitude), parseFloat(stop.Longitude)];
        totalDistance += calculateDistance(
            lastStopPos[0], lastStopPos[1],
            stopPos[0], stopPos[1]
        );
        lastStopPos = stopPos;
    }

    // Find current position if in transit
    const currentStop = routeData.find(stop => 
        now >= new Date(stop.arrival * 1000) && 
        now < new Date(stop.departure * 1000)
    );

    if (!currentStop) {
        const lastStop = [...routeData]
            .filter(stop => now >= new Date(stop.departure * 1000))
            .sort((a, b) => b.departure - a.departure)[0];
        
        const nextStop = [...routeData]
            .filter(stop => now < new Date(stop.arrival * 1000))
            .sort((a, b) => a.arrival - b.arrival)[0];

        if (lastStop && nextStop) {
            const timeProgress = (now - lastStop.departure * 1000) / 
                               (nextStop.arrival * 1000 - lastStop.departure * 1000);
            
            const currentLat = parseFloat(lastStop.Latitude) + 
                             (timeProgress * (parseFloat(nextStop.Latitude) - parseFloat(lastStop.Latitude)));
            const currentLng = parseFloat(lastStop.Longitude) + 
                             (timeProgress * (parseFloat(nextStop.Longitude) - parseFloat(lastStop.Longitude)));
            
            totalDistance += calculateDistance(
                lastStopPos[0], lastStopPos[1],
                currentLat, currentLng
            );
        }
    }

    distanceInitialized = true;
    lastPosition = lastStopPos;
    updateDistanceDisplay(totalDistance);
    console.log(`🛣️ [${now.toISOString().replace('T', ' ').slice(0, 19)}] Initial distance calculated:`, formatNumber(totalDistance), 'km');
}


// Update the display functions to handle imperial units
function updateDistanceDisplay(distance) {
    const distanceValue = document.getElementById('distanceValue');
    if (distanceValue) {
        let displayDistance = distance;
        let unit = 'km';
        
        if (settings.units === 'imperial') {
            displayDistance = distance * 0.621371; // Convert km to miles
            unit = 'miles';
        }
        
        const formattedDistance = Math.round(displayDistance).toLocaleString();
        distanceValue.textContent = `${formattedDistance} ${unit}`;
    }
}

// Add these variables at the top with other global variables
let speedBuffer = []; // Store recent positions and timestamps
const SPEED_BUFFER_SIZE = 5; // Number of recent positions to use for speed calculation

// Add this function to calculate current speed
function calculateCurrentSpeed(newLat, newLon, timestamp) {
    // Add new position to buffer
    speedBuffer.push({
        lat: newLat,
        lon: newLon,
        timestamp: timestamp
    });

    // Keep buffer at desired size
    if (speedBuffer.length > SPEED_BUFFER_SIZE) {
        speedBuffer.shift();
    }

    // Need at least 2 points to calculate speed
    if (speedBuffer.length < 2) {
        return 0;
    }

    // Calculate speed using the most recent positions
    const oldest = speedBuffer[0];
    const newest = speedBuffer[speedBuffer.length - 1];
    
    // Calculate distance in km
    const distance = calculateDistance(
        oldest.lat, oldest.lon,
        newest.lat, newest.lon
    );

    // Calculate time difference in hours
    const timeDiff = (newest.timestamp - oldest.timestamp) / (1000 * 60 * 60);

    // Calculate speed in km/h
    return distance / timeDiff;
}

// Add this function to update the speed display
function updateSpeedDisplay(speed) {
    const speedValue = document.getElementById('currentSpeedValue');
    if (speedValue) {
        let displaySpeed = speed;
        let unit = 'km/h';
        
        if (settings.units === 'imperial') {
            displaySpeed = speed * 0.621371; // Convert km/h to mph
            unit = 'mph';
        }
        
        const formattedSpeed = Math.round(displaySpeed).toLocaleString();
        speedValue.textContent = `${formattedSpeed} ${unit}`;
    }
}

// Function to fetch and update weather
async function updateWeather(latitude, longitude) {
    try {
        const now = getCurrentDateTime();
        const formattedTime = now.toISOString().replace('T', ' ').slice(0, 19);

        // Add temperature unit parameter based on settings
        const useFahrenheit = settings.temperature === 'fahrenheit';
        const temperatureParam = useFahrenheit ? '&temperature_unit=fahrenheit' : '';
        
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true${temperatureParam}`);
        const data = await response.json();

        const weatherValue = document.getElementById('weatherValue');
        if (weatherValue && data.current_weather) {
            const temperature = data.current_weather.temperature;
            const unit = data.current_weather_units.temperature;
            weatherValue.textContent = `${temperature}${unit}`;
           
        }
    } catch (error) {
        console.error(`❌ [${getCurrentDateTime().toISOString().replace('T', ' ').slice(0, 19)}] Weather update error:`, error);
    }
}

// Add these variables at the top with other global variables
let preTrackingData = null;
let lastPreTrackingUpdate = null;

// Function to fetch pre-tracking data
async function fetchPreTrackingData() {
  try {
    const response = await fetch('https://api.npoint.io/6412ce8ae90f2330f538');
    const data = await response.json();
    preTrackingData = data.easter_bunny_pre_tracking_updates.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    console.log('🎯 Pre-tracking data loaded:', preTrackingData.length, 'updates');
  } catch (error) {
    console.error('❌ Error fetching pre-tracking data:', error);
  }
}


// Function to check if we're in pre-tracking time
function isPreTrackingTime(now) {
    const { easterEveDate } = getEasterDates();
    const trackingStart = new Date(easterEveDate);
    trackingStart.setHours(8, 30, 0, 0); // 8:30 AM UTC
    
    const trackingEnd = new Date(easterEveDate);
    trackingEnd.setHours(10, 0, 0, 0); // 10:00 AM UTC
    
    // Use getCurrentDateTime() for comparison
    return getCurrentDateTime() >= trackingStart && getCurrentDateTime() < trackingEnd;
}

// Function to update pre-tracking status
function updatePreTrackingStatus(now) {
    const statusStat = document.querySelector('.status-stat');
    const statusValue = document.getElementById('statusValue');
    
    // Helper function to update status text and handle size
    function updateStatusText(text) {
        statusValue.classList.toggle('long-update', text.length > 125);
        statusValue.innerHTML = text;
    }
    
    const { easterEveDate } = getEasterDates();
    const trackingStart = new Date(easterEveDate);
    trackingStart.setHours(8, 30, 0, 0); // 8:30 AM UTC
    
    const trackingEnd = new Date(easterEveDate);
    trackingEnd.setHours(10, 0, 0, 0); // 10:00 AM UTC

    // Easter Island weather updates
    const easterIslandPosition = [-27.1044228, -109.2489683];
    const currentTime = getCurrentDateTime().getTime();
    if (currentTime - lastWeatherUpdate >= WEATHER_UPDATE_INTERVAL) {
        lastWeatherUpdate = currentTime;
        updateWeather(easterIslandPosition[0], easterIslandPosition[1]);
    }

    if (statusStat) {
        statusStat.style.display = settings.metrics.islandStatus ? 'block' : 'none';
    }

    if (getCurrentDateTime() < trackingStart) {
        const countdown = Math.max(0, Math.floor((trackingStart - getCurrentDateTime()) / 1000));
        updateStatusText(`⏳ Pre-tracking begins in ${formatCountdown(countdown)}`);
        return;
    }
    
    if (getCurrentDateTime() >= trackingEnd) {
        statusStat.style.display = 'none';
        return;
    }

    if (!preTrackingData) {
        updateStatusText('Loading updates...');
        return;
    }

    // Adjust the timestamp comparison to use the current year
    const currentUpdate = preTrackingData.find(update => {
        const updateDate = new Date(update.timestamp);
        const currentDate = getCurrentDateTime();
        
        // Create a new date using current year but keeping month/day/time from the update
        const adjustedUpdateDate = new Date(
            currentDate.getFullYear(),
            updateDate.getMonth(),
            updateDate.getDate(),
            updateDate.getUTCHours(),
            updateDate.getUTCMinutes(),
            updateDate.getUTCSeconds()
        );
        
        return currentDate >= adjustedUpdateDate;
    });

    if (!currentUpdate) {
        updateStatusText('Waiting for updates...');
        return;
    }

    const originalOrder = [...preTrackingData].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
    );
    const currentIndex = originalOrder.findIndex(u => u.timestamp === currentUpdate.timestamp);
    const nextUpdate = originalOrder[currentIndex + 1];

    if (!lastPreTrackingUpdate || lastPreTrackingUpdate.timestamp !== currentUpdate.timestamp) {
        console.log(`🔄 [${getCurrentDateTime().toISOString().replace('T', ' ').slice(0, 19)}] Pre-tracking Update:`, {
            update: currentUpdate.update,
            timestamp: currentUpdate.timestamp
        });
        lastPreTrackingUpdate = currentUpdate;
    }

    if (nextUpdate) {
        // Adjust next update timestamp to current year
        const nextUpdateDate = new Date(nextUpdate.timestamp);
        const currentDate = getCurrentDateTime();
        const adjustedNextUpdate = new Date(
            currentDate.getFullYear(),
            nextUpdateDate.getMonth(),
            nextUpdateDate.getDate(),
            nextUpdateDate.getUTCHours(),
            nextUpdateDate.getUTCMinutes(),
            nextUpdateDate.getUTCSeconds()
        );
        
        const countdown = Math.max(0, Math.floor((adjustedNextUpdate - getCurrentDateTime()) / 1000));
        updateStatusText(`${currentUpdate.update}<br><small>Next update in: ${formatCountdown(countdown)}</small>`);
    } else {
        updateStatusText(currentUpdate.update);
    }
}

// Major Cities Worldwide 🌎
const TEST_LOCATIONS = {
    // Americas
    newYork: { lat: 40.7128, lng: -74.0060 },      // New York City, USA 🗽
    losAngeles: { lat: 34.0522, lng: -118.2437 },  // Los Angeles, USA 🌴
    toronto: { lat: 43.6532, lng: -79.3832 },      // Toronto, Canada 🍁
    rioDeJaneiro: { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro, Brazil 🏖️
    
    // Europe
    london: { lat: 51.5074, lng: -0.1278 },        // London, UK 🇬🇧
    paris: { lat: 48.8566, lng: 2.3522 },          // Paris, France 🗼
    rome: { lat: 41.9028, lng: 12.4964 },          // Rome, Italy 🏛️
    moscow: { lat: 55.7558, lng: 37.6173 },        // Moscow, Russia 🏰
    
    // Asia/Pacific
    tokyo: { lat: 35.6762, lng: 139.6503 },        // Tokyo, Japan 🗼
    sydney: { lat: -33.8688, lng: 151.2093 },      // Sydney, Australia 🦘
    singapore: { lat: 1.3521, lng: 103.8198 },     // Singapore 🌆
    dubai: { lat: 25.2048, lng: 55.2708 },         // Dubai, UAE 🌇
    
    // Interesting Edge Cases 🎯
    rapa_nui: { lat: -27.1044228, lng: -109.2489683 }, // Easter Island itself! 🗿
    honolulu: { lat: 21.3069, lng: -157.8583 },    // Honolulu - Pacific crossing test 🌺
    anchorage: { lat: 61.2181, lng: -149.9003 },   // Anchorage - Far north test ❄️
    wellington: { lat: -41.2924, lng: 174.7787 },   // Wellington, NZ - Far south test 🥝
    
    // Remote Locations 🏝️
    midway: { lat: 28.2072, lng: -177.3735 },      // Midway Atoll - Remote Pacific
    svalbard: { lat: 78.2232, lng: 15.6267 },      // Svalbard - Arctic Circle
    reunion: { lat: -21.1151, lng: 55.5364 },      // Réunion Island - Indian Ocean
    easter: { lat: -27.1044228, lng: -109.2489683 },  // Easter Island
    // Remote Cities & Villages 🏘️
    ushuaia: { lat: -54.8019, lng: -68.3030 },     // Ushuaia, Argentina - Southernmost city 🏔️
    longyearbyen: { lat: 78.2232, lng: 15.6267 },  // Longyearbyen, Svalbard - Northernmost town ❄️
    iqaluit: { lat: -63.7467, lng: -68.5170 },     // Iqaluit, Nunavut, Canada - Remote arctic 🌨️
    adamstown: { lat: -25.0661, lng: -130.1015 },  // Adamstown, Pitcairn Islands - Tiny population 🏝️
    
    // Small Villages 🏡
    grise_fiord: { lat: 76.4183, lng: -82.8951 },  // Grise Fiord, Canada - Northernmost community in Americas ❄️
    oymyakon: { lat: 63.4620, lng: 142.7866 },     // Oymyakon, Russia - Coldest inhabited place 🥶
    whittier: { lat: 60.7730, lng: -148.6838 },    // Whittier, Alaska - Entire town in one building! 🏢
    coober_pedy: { lat: -29.0135, lng: 134.7544 }, // Coober Pedy, Australia - Underground town ⛏️
    
    // Remote Islands 🏝️
    tristan: { lat: -37.1052, lng: -12.2777 },     // Tristan da Cunha - Most remote inhabited island
    bouvet: { lat: -54.4208, lng: 3.3464 },        // Bouvet Island - Uninhabited remote island
    kerguelen: { lat: -49.3500, lng: 70.2167 },    // Kerguelen Islands - French Southern Territories
    baker_island: { lat: 0.1936, lng: -176.4786 }, // Baker Island - Uninhabited US territory
    
    // Desert Communities 🏜️
    timbuktu: { lat: 16.7666, lng: -3.0026 },      // Timbuktu, Mali - Ancient Saharan city
    alice_springs: { lat: -23.6980, lng: 133.8807 },// Alice Springs, Australia - Outback town
    dunhuang: { lat: 40.1130, lng: 94.6618 },      // Dunhuang, China - Gobi Desert oasis
    wahat: { lat: 29.2097, lng: 26.5890 },         // Al Wahat, Egypt - Desert oasis

    // Mountain Villages 🏔️
    la_rinconada: { lat: -14.6306, lng: -69.4459 }, // La Rinconada, Peru - Highest city
    namche_bazaar: { lat: 27.8069, lng: 86.7140 }, // Namche Bazaar, Nepal - Sherpa capital
    murren: { lat: 46.5590, lng: 7.8926 },         // Mürren, Switzerland - Car-free mountain village
    zermatt: { lat: 46.0207, lng: 7.7491 },        // Zermatt, Switzerland - Under the Matterhorn

    // Jungle Settlements 🌴
    manaus: { lat: -3.1190, lng: -60.0217 },       // Manaus, Brazil - Amazon rainforest
    iquitos: { lat: -3.7437, lng: -73.2516 },      // Iquitos, Peru - Largest isolated city
    palangkaraya: { lat: -2.2161, lng: 113.9135 }, // Palangkaraya, Indonesia - Borneo jungle
    rurrenabaque: { lat: -14.4412, lng: -67.5278 }, // Rurrenabaque, Bolivia - Amazon gateway

    // Tiny Island Communities 🌺
    palm_island: { lat: -18.7499, lng: 146.5872 }, // Palm Island, Australia
    niue: { lat: -19.0544, lng: -169.8672 },       // Niue - Coral atoll nation
    tokelau: { lat: -9.2002, lng: -171.8484 },     // Tokelau - New Zealand territory
    pitcairn: { lat: -25.0677, lng: -130.1002 },   // Pitcairn Islands

    // Remote Arctic/Antarctic Research Stations ❄️
    mcmurdo: { lat: -77.8419, lng: 166.6863 },     // McMurdo Station, Antarctica
    vostok: { lat: -78.4645, lng: 106.8342 },      // Vostok Station, Antarctica
    alert: { lat: 82.5018, lng: -62.3481 },        // Alert, Nunavut - Northernmost settlement
    eureka: { lat: 79.9894, lng: -85.9408 },       // Eureka, Nunavut - Research station

    // Remote Continental Points 🗺️
    cape_york: { lat: -10.6841, lng: 142.5278 },   // Cape York, Australia - Northernmost point
    point_nemo: { lat: -48.8767, lng: -123.3933 }, // Point Nemo - Oceanic pole of inaccessibility
    ittoqqortoormiit: { lat: 70.4833, lng: -21.9667 }, // Ittoqqortoormiit, Greenland
    barrow: { lat: 71.2906, lng: -156.7886 },      // Utqiaġvik (Barrow), Alaska

    // Isolated Continental Locations 🌎
    yakutsk: { lat: 62.0355, lng: 129.6755 },      // Yakutsk, Russia - Coldest major city
    norilsk: { lat: 69.3498, lng: 88.2014 },       // Norilsk, Russia - Isolated industrial city
    dabancheng: { lat: 43.3614, lng: 88.3125 },    // Dabancheng, China - Wind city
    fordlandia: { lat: -3.6619, lng: -55.497 },    // Fordlandia, Brazil - Abandoned city

    // Remote Coastal Settlements 🏖️
    barrow: { lat: 71.2906, lng: -156.7886 },      // Utqiaġvik/Barrow, Alaska - Northernmost US city
    provideniya: { lat: 64.3833, lng: -173.3000 }, // Provideniya, Russia - Remote Bering Strait
    esperanza: { lat: -63.3973, lng: -56.9972 },   // Esperanza Base, Antarctica
    grytviken: { lat: -54.2811, lng: -36.5092 },   // Grytviken, South Georgia Island

    // Cultural Heritage Sites in Remote Areas 🏺
    petra: { lat: 30.3285, lng: 35.4444 },         // Petra, Jordan - Ancient city
    angkor: { lat: 13.4125, lng: 103.8670 },       // Angkor Wat, Cambodia
    machu_picchu: { lat: -13.1631, lng: -72.5450 }, // Machu Picchu, Peru
    // Space???   🚀
    iss: { 
        lat: -25.1162, 
        lng: -43.1948, 
        name: "International Space Station (Current) 🛸" 
    },
};

// Add to global variables
let userLocation = null;
let nearestStop = null;
const LOCATION_TEST_MODE = true;
const TEST_COORDINATES = TEST_LOCATIONS.iss;  // Try different locations!

// Helper function to calculate distance between coordinates
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
             Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Function to format arrival time
function formatArrivalTime(date) {
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

// Function to round time to nearest quarter hour
function roundToQuarterHour(hours) {
    return Math.round(hours * 4) / 4;
}

// Function to create time range
function createTimeRange(date) {
    const minutes = date.getMinutes();
    if ([0, 10, 20, 30, 40, 50].includes(minutes)) {
        return formatArrivalTime(date);
    }
    
    const roundDown = new Date(date);
    roundDown.setMinutes(Math.floor(minutes / 10) * 10);
    const roundUp = new Date(date);
    roundUp.setMinutes(Math.ceil(minutes / 10) * 10);
    
    return `${roundDown.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${roundUp.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

// Function to find nearest stop
function findNearestStop(lat, lng) {
    let nearest = null;
    let minDistance = Infinity;
    
    for (const stop of routeData) {
        const distance = calculateHaversineDistance(
            lat, lng,
            parseFloat(stop.Latitude),
            parseFloat(stop.Longitude)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            nearest = stop;
        }
    }
    
    return nearest;
}

// Function to update arrival message
function updateArrivalMessage() {
    if (!userLocation || !nearestStop) return;
    
    const now = getCurrentDateTime();
    const arrivalTime = new Date(nearestStop.arrival * 1000);
    const nextStop = [...routeData]
        .filter(stop => now < new Date(stop.arrival * 1000))
        .sort((a, b) => a.arrival - b.arrival)[0];
    
    const isNextStop = nextStop && nextStop.City === nearestStop.City;
    const arrivalValue = document.getElementById('arrivalValue');
    
    // Easter Bunny already visited
    if (now >= arrivalTime) {
        arrivalValue.innerHTML = `🎉 The Easter Bunny arrived at around ${formatArrivalTime(arrivalTime)}! Hope you enjoyed (or will enjoy) the fun egg hunt and see you next year! 🥚🌸`;
        return;
    }
    
    // Calculate hours until arrival
    const hoursUntil = (arrivalTime - now) / (1000 * 60 * 60);
    
    if (hoursUntil <= 1) {
        const timeRange = createTimeRange(arrivalTime);
        if (isNextStop) {
            arrivalValue.innerHTML = `🌟 EGGS-CITING NEWS! The Easter Bunny is hopping straight to your area next! Get ready, and ensure you have your carrots out! 🥕🐰✨`;
        } else {
            arrivalValue.innerHTML = `🌸 The Easter Bunny will be hopping to you ${timeRange}! 🐰🥚`;
        }
    } else {
        const roundedHours = roundToQuarterHour(hoursUntil);
        const hourText = roundedHours === 1 ? 'hour' : 'hours';
        const fractionPart = roundedHours % 1;
        let timeText;
        
        if (fractionPart === 0) timeText = `${roundedHours}`;
        else if (fractionPart === 0.25) timeText = `${Math.floor(roundedHours)}¼`;
        else if (fractionPart === 0.5) timeText = `${Math.floor(roundedHours)}½`;
        else timeText = `${Math.floor(roundedHours)}¾`;
        
        arrivalValue.innerHTML = `🌸 The Easter Bunny will arrive to deliver your baskets and eggs in about ${timeText} ${hourText} 🧺✨`;
    }
}

// Function to handle location access
async function handleLocationAccess() {
    const arrivalValue = document.getElementById('arrivalValue');
    
    if (LOCATION_TEST_MODE) {
        userLocation = TEST_COORDINATES;
        nearestStop = findNearestStop(userLocation.lat, userLocation.lng);
        updateArrivalMessage();
        return;
    }
    
    if (!navigator.geolocation) {
        arrivalValue.innerHTML = '📱 Oops! Your browser doesn\'t support location services. Unable to estimate arrival time.';
        return;
    }
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        
        nearestStop = findNearestStop(userLocation.lat, userLocation.lng);
        updateArrivalMessage();
        
    } catch (error) {
        if (error.code === 1) {
            arrivalValue.innerHTML = '🔒 Location access denied. Please enable location services and try clicking again to see when the Easter Bunny will visit!';
        } else {
            arrivalValue.innerHTML = '❌ Unable to get your location. Click to try again!';
        }
    }
}

// Add click handler to arrival value element
function initializeArrivalEstimator() {
    const arrivalValue = document.getElementById('arrivalValue');
    arrivalValue.innerHTML = '🔍 Click here to reveal when the Easter Bunny will arrive! 🐰';
    arrivalValue.style.cursor = 'pointer';
    arrivalValue.addEventListener('click', () => {
        if (!userLocation) {
            handleLocationAccess();
        }
    });
}

// Add to your initialization code
document.addEventListener('DOMContentLoaded', () => {
    initializeArrivalEstimator();
});

// Add to global variables 🎯
let destinationMarkers = new Map(); // Store markers by unique location key

// Create marker icons 🎨
const markerIcons = {
    unvisited: L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/7226/7226674.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        tooltipAnchor: [0, -36]
    }),
    visited: L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/7226/7226114.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        tooltipAnchor: [0, -36]
    }),
    iss: L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/16116/16116385.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        tooltipAnchor: [0, -36]
    })
};

// Add CSS styles 🎨
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    .destination-tooltip {
        background-color: rgba(255, 255, 255, 0.95);
        border: 2px solid #ff69b4;
        border-radius: 12px;
        padding: 8px 12px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .leaflet-tooltip-top.destination-tooltip:before {
        border-top-color: #ff69b4;
    }
    
    /* Ensure Easter Bunny marker stays on top */
    .bunny-marker {
        z-index: 1000 !important;
    }
`;
document.head.appendChild(styleSheet);

// Helper function to safely format numbers
function formatNumberWithCommas(num) {
    if (num === undefined || num === null) {
        console.warn('Received undefined/null number to format');
        return '0';
    }
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Helper function to safely get previous stop's baskets
function getPreviousStopBaskets(stop) {
    if (!stop || !routeData) return 0;
    
    const stopIndex = routeData.findIndex(s => 
        s.City === stop.City && 
        s.Region === stop.Region
    );
    
    if (stopIndex <= 0) return 0;
    
    const previousBaskets = routeData[stopIndex - 1].basketsDelivered;
    return previousBaskets || 0;
}


// Function to fetch Wikipedia summary with better error handling
async function fetchWikiSummary(wikiLink) {
    if (!wikiLink) {
        console.error('❌ No Wikipedia link provided');
        throw new Error('No Wikipedia link provided');
    }

    try {
        const searchTerm = wikiLink.split('/wiki/')[1];
        console.log(`🔍 Fetching Wikipedia data for: ${searchTerm}`);
        
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${searchTerm}`);
        
        if (!response.ok) {
            throw new Error(`Wikipedia API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`✅ Wikipedia data fetched for: ${searchTerm}`);
        
        return {
            description: data.description || 'No description available',
            extract: (data.extract || 'No extract available'),
            fullLink: wikiLink
        };
    } catch (error) {
        console.error('❌ Error fetching Wikipedia summary:', error);
        throw error; // Propagate error for handling in createPopupContent
    }
}

// Function to create popup content
async function createPopupContent(stop) {
    try {
        console.log('Creating popup for stop:', stop);

        // Validate stop data
        if (!stop) throw new Error('No stop data provided');
        
        // Safely get values with defaults using correct field names
        const basketsAtStop = (stop.basketsDelivered || 0) - getPreviousStopBaskets(stop);
        const now = getCurrentDateTime();
        const arrivalTime = stop.arrival * 1000; // Don't modify for marker state check
        const population = stop['Population Num'] || 0;
        const populationYear = stop['Population Year'] || 'N/A';
        const timezone = stop.Timezone || 'UTC';
        const wikiLink = stop['Wikipedia attr'];

        // Get user's timezone
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Create content
        const content = document.createElement('div');
        content.innerHTML = `
            <div class="popup-header">
                ${getRegionFlag(stop.Region)} ${stop.City || 'Unknown City'}, ${stop.Region || 'Unknown Region'}
            </div>
            
            <div class="popup-stat">
                <img src="https://cdn-icons-png.flaticon.com/512/7226/7226114.png" alt="🧺" class="icon-img"/>
                <div class="popup-stat-content">
                    <span class="popup-stat-label">${now >= arrivalTime ? 'Baskets delivered here' : 'Baskets to deliver here'}</span>
                    ${formatNumberWithCommas(basketsAtStop)}
                </div>
            </div>
            
            <div class="popup-stat">
                <span class="material-symbols-rounded">group</span>
                <div class="popup-stat-content">
                    <span class="popup-stat-label">Population</span>
                    ${formatNumberWithCommas(population)} (${populationYear})
                </div>
            </div>
            
            <div class="popup-stat">
                <span class="material-symbols-rounded">schedule</span>
                <div class="popup-stat-content">
                    <span class="popup-stat-label">${now >= arrivalTime ? 'Arrived at' : 'Arriving at'}</span>
                    Your time (${userTimezone}): ${formatDateInTimezone(stop.arrival, userTimezone)}<br>
                    Local time (${timezone}): ${formatDateInTimezone(stop.arrival, timezone)}
                </div>
            </div>`;

        // Only add Wikipedia section if URL exists
        if (wikiLink) {
            content.innerHTML += `
                <div class="popup-overview">
                    <div class="popup-description">Loading Wikipedia info...</div>
                </div>`;

            try {
                const wikiInfo = await fetchWikiSummary(wikiLink);
                const overviewDiv = content.querySelector('.popup-overview');
                overviewDiv.innerHTML = `
                    <div class="popup-description">${wikiInfo.description || 'No description available'}</div>
                    <div class="popup-extract">${wikiInfo.extract || 'No extract available'}</div>
                    <a href="${wikiLink}" target="_blank" class="popup-wiki-link">
                        Read more on Wikipedia
                        <span class="material-symbols-rounded">open_in_new</span>
                    </a>`;
            } catch (wikiError) {
                console.warn('Wikipedia fetch error:', wikiError);
                const overviewDiv = content.querySelector('.popup-overview');
                overviewDiv.innerHTML = `
                    <div class="popup-description">Wikipedia info currently unavailable</div>
                    <a href="${wikiLink}" target="_blank" class="popup-wiki-link">
                        View on Wikipedia
                        <span class="material-symbols-rounded">open_in_new</span>
                    </a>`;
            }
        }

        return content;

    } catch (error) {
        console.error('Error creating popup content:', error);
        console.log('Problematic stop data:', stop);
        
        // Return error content
        const errorContent = document.createElement('div');
        errorContent.innerHTML = `
            <div class="popup-header">
                ${stop?.Region ? getRegionFlag(stop.Region) : '🏳️'} 
                ${stop?.City || 'Unknown City'}, 
                ${stop?.Region || 'Unknown Region'}
            </div>
            <div class="popup-stat">
                <span class="material-symbols-rounded">error</span>
                <div class="popup-stat-content">
                    <span class="popup-stat-label">Error Details</span>
                    An error occurred loading this stop's information
                </div>
            </div>`;
        return errorContent;
    }
}

// Helper function to format date in timezone (modified to fix UTC display)
function formatDateInTimezone(timestamp, timezone) {
    try {
        // Add one hour (3600 seconds) only for display purposes
        const adjustedTimestamp = (timestamp + 3600) * 1000;
        return new Date(adjustedTimestamp).toLocaleString('en-US', {
            timeZone: timezone || 'UTC',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        console.error('Error formatting date:', e, 'timestamp:', timestamp, 'timezone:', timezone);
        return 'Time unknown';
    }
}


// Function to initialize destination markers 🗺️
async function initializeDestinationMarkers() {
    console.log('🗺️ Starting marker initialization...');
    
    // Clear existing markers
    destinationMarkers.forEach(marker => marker.remove());
    destinationMarkers.clear();

    // Create all markers with tooltips and popups
    for (const stop of routeData) {
        if (stop.City === "Easter Bunny's Workshop") continue;

        const locationKey = `${stop.Latitude},${stop.Longitude}`;

        if (!destinationMarkers.has(locationKey)) {
            const marker = L.marker(
                [parseFloat(stop.Latitude), parseFloat(stop.Longitude)],
                { 
                    icon: markerIcons.unvisited,
                    zIndexOffset: 100
                }
            );

            // Add tooltip
            marker.bindTooltip(
                `${getRegionFlag(stop.Region)} ${stop.City}, ${stop.Region}`,
                {
                    direction: 'top',
                    permanent: false,
                    className: 'destination-tooltip'
                }
            );

            // Create initial popup with loading state
            const loadingPopup = L.popup({
                className: 'custom-popup',
                maxWidth: 300,
                minWidth: 300
            }).setContent('<div class="popup-header">Loading...</div>');

            marker.bindPopup(loadingPopup);

            // Add click handler to load content
            marker.on('click', async function() {
                if (!marker.getPopup().getContent().includes('Loading...')) {
                    return; // Content already loaded
                }
                
                console.log('🔄 Loading popup content for:', stop.City);
                try {
                    const content = await createPopupContent(stop);
                    marker.getPopup().setContent(content);
                    marker.getPopup().update();
                    console.log('✅ Popup content loaded for:', stop.City);
                } catch (error) {
                    console.error('❌ Error loading popup content for:', stop.City, error);
                    marker.getPopup().setContent('<div class="popup-header">Error loading content</div>');
                    marker.getPopup().update();
                }
            });

            // Add to map
            marker.addTo(map);
            destinationMarkers.set(locationKey, {
                marker: marker,
                stops: [stop]
            });
        } else {
            destinationMarkers.get(locationKey).stops.push(stop);
        }
    }

    console.log(`✨ All markers initialized: ${destinationMarkers.size}`);
}

// Function to update marker states 🔄
function updateMarkerStates() {
    const now = getCurrentDateTime();

    destinationMarkers.forEach((markerData, locationKey) => {
        const { marker, stops } = markerData;
        
        // Find earliest arrival and latest departure for this location
        const earliestArrival = Math.min(...stops.map(stop => stop.arrival));
        const latestDeparture = Math.max(...stops.map(stop => stop.departure));

        // Check if the location is the International Space Station
        const isISS = stops.some(stop => stop.City === "International Space Station");

        // Determine marker state
        const hasVisited = now >= latestDeparture * 1000;
        const isCurrentlyHere = now >= earliestArrival * 1000 && now < latestDeparture * 1000;

        // Update marker appearance
        if (isCurrentlyHere) {
            // Easter Bunny is here - hide marker
            marker.setOpacity(0);
        } else if (isISS) {
            // Use ISS icon for the International Space Station
            marker.setOpacity(1);
            marker.setIcon(markerIcons.iss);
        } else if (hasVisited) {
            // Location visited - show visited icon
            marker.setOpacity(1);
            marker.setIcon(markerIcons.visited);
        } else {
            // Not visited yet - show unvisited icon
            marker.setOpacity(1);
            marker.setIcon(markerIcons.unvisited);
        }
    });
}

function getGlobeEmoji(timezone) {
    // Lists of regions for each globe emoji
    const americas = ['America', 'Argentina', 'Brazil', 'Canada', 'Chile', 'Mexico'];
    const asiaOceania = ['Asia', 'Japan', 'Singapore', 'Australia', 'Pacific', 'Indian'];
    
    // Check which region the timezone belongs to
    if (americas.some(region => timezone.includes(region))) {
        return '🌎'; // Americas
    } else if (asiaOceania.some(region => timezone.includes(region))) {
        return '🌏'; // Asia/Oceania
    } else {
        return '🌍'; // Europe/Africa (default)
    }
}

function updateLocalTime() {
    try {
        const now = getCurrentDateTime();
        
        // Get current and next stops using your existing logic
        const currentStop = routeData.find(stop => 
            now >= new Date(stop.arrival * 1000) && 
            now < new Date(stop.departure * 1000)
        );
        
        const nextStop = [...routeData]
            .filter(stop => now < new Date(stop.arrival * 1000))
            .sort((a, b) => a.arrival - b.arrival)[0];

        // Get the timezone to use
        let timezone;
        if (currentStop) {
            timezone = currentStop.Timezone;
        } else if (nextStop) {
            timezone = nextStop.Timezone;
        } else {
            // Pre-journey or post-journey: Use Easter Island timezone
            timezone = "Pacific/Easter";
        }

        if (timezone) {
            let localTime, tzAbbr;

            // Try moment.js first
            if (typeof moment !== 'undefined' && moment.tz) {
                localTime = moment().tz(timezone).format('h:mm A');
                // Special case for Easter Island
                tzAbbr = timezone === "Pacific/Easter" ? "EASST" : moment().tz(timezone).format('z');
            } else {
                // Fallback to native JavaScript
                localTime = new Date().toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: timezone
                });

                // Special case for Easter Island
                if (timezone === "Pacific/Easter") {
                    tzAbbr = "EASST";
                } else {
                    tzAbbr = new Date().toLocaleTimeString('en-US', {
                        timeZone: timezone,
                        timeZoneName: 'short'
                    }).split(' ').pop();
                }
            }
            
            // Get the appropriate globe emoji for this timezone
            const globeEmoji = getGlobeEmoji(timezone);
            
            document.getElementById('timezoneValue').innerHTML = 
                `${localTime} (${tzAbbr}) ${globeEmoji}`;
        } else {
            document.getElementById('timezoneValue').innerHTML = 
                'Hopping between time zones... 🐇';
        }
    } catch (error) {
        console.error('Error updating local time:', error);
        document.getElementById('timezoneValue').innerHTML = 
            'Calculating bunny time... 🕰️';
    }
}

// Add this to your existing update cycle
setInterval(updateLocalTime, 1000); // Update every second ⏱️


// Basket and carrot counter variables 🧺🥕
let currentBasketCount = 0;
let targetBasketCount = 0;
let currentCarrotCount = 0;
let targetCarrotCount = 0;

// Add this helper function for formatting large numbers
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Add this function to calculate current baskets
function calculateCurrentBaskets(now, currentStop, lastStop, nextStop) {
    if (!routeData || routeData.length === 0) return 0;
    
    // Pre-journey
    const easterEveStart = new Date(getEasterDates().easterEveDate);
    easterEveStart.setHours(10, 0, 0, 0);
    if (now < easterEveStart) return 0;
    
    // Post-journey
    const easterDayEnd = new Date(getEasterDates().easterEveDate);
    easterDayEnd.setDate(easterDayEnd.getDate() + 1);
    easterDayEnd.setHours(11, 10, 0, 0);
    if (now >= easterDayEnd) return 7706250000;
    
    // During a stop
    if (currentStop) {
        const stopStartTime = new Date(currentStop.arrival * 1000);
        const stopEndTime = new Date(currentStop.departure * 1000);
        const progress = Math.max(0, Math.min(1, 
            (now - stopStartTime) / (stopEndTime - stopStartTime)
        ));
        
        // Special handling for first real stop (London, Kiribati)
        if (lastStop && lastStop.City === "Easter Bunny's Workshop") {
            return Math.round(currentStop.basketsDelivered * progress);
        }
        
        const previousStopBaskets = lastStop ? lastStop.basketsDelivered : 0;
        const basketsToDeliver = currentStop.basketsDelivered - previousStopBaskets;
        
        return Math.round(previousStopBaskets + basketsToDeliver * progress);
    }
    
    // In transit between stops
    if (lastStop && nextStop) {
        const transitStartTime = new Date(lastStop.departure * 1000);
        const transitEndTime = new Date(nextStop.arrival * 1000);
        const progress = Math.max(0, Math.min(1,
            (now - transitStartTime) / (transitEndTime - transitStartTime)
        ));
        
        // Special handling for transit from workshop
        if (lastStop.City === "Easter Bunny's Workshop") {
            return Math.round(nextStop.basketsDelivered * progress);
        }
        
        const basketDifference = nextStop.basketsDelivered - lastStop.basketsDelivered;
        return Math.round(lastStop.basketsDelivered + basketDifference * progress);
    }
    
    return 0;
}

// Calculate current carrots eaten 🥕
function calculateCurrentCarrots(now, currentStop, lastStop, nextStop) {
    if (!routeData || routeData.length === 0) return 0;
    
    // Pre-journey
    const easterEveStart = new Date(getEasterDates().easterEveDate);
    easterEveStart.setHours(10, 0, 0, 0);
    if (now < easterEveStart) return 0;
    
    // Post-journey
    const easterDayEnd = new Date(getEasterDates().easterEveDate);
    easterDayEnd.setDate(easterDayEnd.getDate() + 1);
    easterDayEnd.setHours(11, 10, 0, 0);
    if (now >= easterDayEnd) {
        const lastStopInJourney = [...routeData]
            .sort((a, b) => b.departure - a.departure)[0];
        return lastStopInJourney ? lastStopInJourney.carrotsEaten : 0;
    }
    
    // During a stop
    if (currentStop) {
        const stopStartTime = new Date(currentStop.arrival * 1000);
        const stopEndTime = new Date(currentStop.departure * 1000);
        const progress = Math.max(0, Math.min(1,
            (now - stopStartTime) / (stopEndTime - stopStartTime)
        ));
        
        // Special handling for first real stop (London, Kiribati)
        if (lastStop && lastStop.City === "Easter Bunny's Workshop") {
            return Math.round(currentStop.carrotsEaten * progress);
        }
        
        const previousStopCarrots = lastStop ? lastStop.carrotsEaten : 0;
        const carrotsToEat = currentStop.carrotsEaten - previousStopCarrots;
        
        return Math.round(previousStopCarrots + carrotsToEat * progress);
    }
    
    // In transit between stops
    if (lastStop && nextStop) {
        const transitStartTime = new Date(lastStop.departure * 1000);
        const transitEndTime = new Date(nextStop.arrival * 1000);
        const progress = Math.max(0, Math.min(1,
            (now - transitStartTime) / (transitEndTime - transitStartTime)
        ));
        
        // Special handling for transit from workshop
        if (lastStop.City === "Easter Bunny's Workshop") {
            return Math.round(nextStop.carrotsEaten * progress);
        }
        
        const carrotDifference = nextStop.carrotsEaten - lastStop.carrotsEaten;
        return Math.round(lastStop.carrotsEaten + carrotDifference * progress);
    }
    
    return 0;
}

// Update both baskets and carrots display with animation
function updateCounterDisplays(newBaskets, newCarrots) {
    const presentsValue = document.getElementById('presentsValue');
    const cookiesValue = document.getElementById('cookiesValue');
    
    if (presentsValue) {
        currentBasketCount = newBaskets;
        presentsValue.textContent = formatNumber(currentBasketCount);
    }
    
    if (cookiesValue) {
        currentCarrotCount = newCarrots;
        cookiesValue.textContent = formatNumber(currentCarrotCount);
    }
}


// Test mode toggle 🧪
const TEST_MODE = false; // Set to true to simulate April 19th

// Helper function to get current date/time (real or test mode) 🕒
function getCurrentDateTime() {
    let now = new Date();
    if (TEST_MODE) {
        // Create a new date with April 19th but keep current time
        return new Date(
            now.getFullYear(),  // Current year
            3,                  // April (0-based)
            19,                 // 19th
            now.getUTCHours(), // Replace with now.getUTCHours() for current hour
            now.getUTCMinutes(),
            now.getUTCSeconds()
        );
    }
    return now;
}

// Calculate Easter dates 📅
function getEasterDates() {
    const currentDate = getCurrentDateTime();
    const currentYear = currentDate.getFullYear();
    
    // Get Easter Eve dates for current and next year using our calculation function
    const easterEveDate = getEasterEveDate(currentYear);
    const nextYearEasterEveDate = getEasterEveDate(currentYear + 1);
    
    // Calculate days to adjust based on the 2023 route date (April 8)
    const reference2023Date = new Date(Date.UTC(currentYear, 3, 8)); // April 8, 2023
    const daysToAdjust = Math.round((easterEveDate - reference2023Date) / (1000 * 60 * 60 * 24));
    
    return {
        easterEveDate,
        nextYearEasterEveDate,
        daysToAdjust
    };
}

// Format countdown time ⏱️
function formatCountdown(seconds) {
    if (seconds >= 86400) { // 24 hours
        return Math.ceil(seconds / 86400) + 'd';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Fetch and process route data 🛣️
let routeData = [];
async function fetchRouteData() {
  try {
    console.log('🔄 Fetching Easter Bunny route data...');
    const response = await fetch('https://api.npoint.io/adf585d984bb6a571cb7');
    const data = await response.json();
        
    // Calculate the exact difference between 2023 route and 2025 route
    const route2023Start = new Date(2023, 3, 8, 10, 0, 0); // April 8, 2023 10:00 UTC
    const route2025Start = new Date(2025, 3, 19, 10, 0, 0); // April 19, 2025 10:00 UTC
    const timeDifferenceSeconds = Math.floor((route2025Start - route2023Start) / 1000);
        
    console.log('📅 2023 Route Start:', route2023Start.toISOString());
    console.log('📅 2025 Route Start:', route2025Start.toISOString());
    console.log('⏱️ Time Difference (seconds):', timeDifferenceSeconds);
        
    // Process each stop
    routeData = data.route.map(stop => {
      // Adjust Unix timestamps by adding the exact difference
      const arrival = parseInt(stop["Unix Arrival"]) + timeDifferenceSeconds;
      const departure = arrival + parseInt(stop["Arrival Stoppage Time"]);
           
      return {
        ...stop,
        arrival,
        departure,
        basketsDelivered: Math.ceil(parseInt(stop["Eggs Delivered"]) * 1.25),
        carrotsEaten: Math.ceil(parseInt(stop["Carrots eaten"]) * 1.25)
      };
    });
        
    console.log('✅ Route data processed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error fetching route data:', error);
    return false;
  }
}
// Add these at the top with other global variables
let lastWeatherUpdate = 0;
const WEATHER_UPDATE_INTERVAL = 10000; // 20 seconds in milliseconds

// Update Easter Bunny location and stats 🐰
function updateBunnyLocation() {
    try {
        const now = getCurrentDateTime();
        const formattedTime = now.toISOString().replace('T', ' ').slice(0, 19);
        console.log(`🕒 [${formattedTime}] Updating bunny location...`);
        
        const { easterEveDate, nextYearEasterEveDate } = getEasterDates();
        
        const easterEveStart = new Date(easterEveDate);
        easterEveStart.setHours(10, 0, 0, 0); // 10:00 AM UTC
        
        const easterDayEnd = new Date(easterEveDate);
        easterDayEnd.setDate(easterDayEnd.getDate() + 1);
        easterDayEnd.setHours(11, 10, 0, 0); // 11:10 AM UTC next day
        
        // Update stats container elements
        const currentStopLabel = document.querySelector('#currentStopLabel');
        const currentStopValue = document.querySelector('#currentStopValue');
        const departingLabel = document.querySelector('#departingLabel');
        const departingValue = document.querySelector('#departingValue');
        const lastSeenValue = document.querySelector('#lastSeenValue');
        const currentSpeedValue = document.querySelector('#currentSpeedValue');


        // Helper function to update total distance
        function updateTotalDistance(newLat, newLon) {
            if (lastPosition) {
                const segmentDistance = calculateDistance(
                    lastPosition[0], lastPosition[1],
                    newLat, newLon
                );
                totalDistance += segmentDistance;
                updateDistanceDisplay(totalDistance);
            }
            lastPosition = [newLat, newLon];
        }
        
        // Helper function to set Easter Island location
        function setEasterIslandLocation(countdownTarget) {
            try {
                const islandPosition = [-27.1044228, -109.2489683];
                bunnyMarker.setLatLng(islandPosition);
                updateTotalDistance(islandPosition[0], islandPosition[1]);

        let unit = 'km/h';
        
        if (settings.units === 'imperial') {
            unit = 'mph';
        }
     
                
                currentStopLabel.innerHTML = '<span class="material-symbols-rounded">location_on</span> Current stop';
                currentStopValue.textContent = `${getRegionFlag("Easter Island, Chile")} Easter Bunny's Workshop, Easter Island, Chile`;
                departingLabel.innerHTML = '<span class="material-icons">flight_takeoff</span> The Easter Bunny lifts off in';
                lastSeenValue.textContent = "-";
                currentSpeedValue.textContent = `0 ${unit}`;
                
                // Update baskets and carrots for pre/post journey
                const finalBaskets = now < easterEveStart ? 0 : 7706250000;
                const finalCarrots = now < easterEveStart ? 0 : routeData[routeData.length - 1]?.carrotsEaten || 0;
                
                console.log(`🏝️ [${formattedTime}] Easter Island Stats:`, {
                    baskets: formatNumber(finalBaskets),
                    carrots: formatNumber(finalCarrots),
                    status: now < easterEveStart ? 'Pre-journey' : 'Post-journey'
                });
                
                if (targetBasketCount !== finalBaskets || targetCarrotCount !== finalCarrots) {
                    targetBasketCount = finalBaskets;
                    targetCarrotCount = finalCarrots;
                    updateCounterDisplays(finalBaskets, finalCarrots);
                }
                
                const countdown = Math.max(0, Math.floor((countdownTarget - now) / 1000));
                departingValue.textContent = formatCountdown(countdown);
                

                if (isMapLocked) {
                    map.setView(islandPosition, map.getZoom(), {animate: false});
                }
            } catch (error) {
                console.error(`❌ [${formattedTime}] Error in setEasterIslandLocation:`, error);
            }
        }

        // Helper function to check and update weather if needed
        function checkWeatherUpdate(lat, lon) {
            const currentTime = now.getTime();
            if (currentTime - lastWeatherUpdate >= WEATHER_UPDATE_INTERVAL) {
                lastWeatherUpdate = currentTime;
                updateWeather(lat, lon);
            }
        }
        
// Initialize distance if not done yet
if (!distanceInitialized) {
    initializeDistance(now);
}

        // Before journey starts or after journey ends
        if (now < easterEveStart || now >= easterDayEnd) {
            setEasterIslandLocation(now < easterEveStart ? easterEveStart : new Date(nextYearEasterEveDate));
            return;
        }
        
        // Find the last visited stop
        const lastStop = [...routeData]
            .filter(stop => now >= new Date(stop.departure * 1000))
            .sort((a, b) => b.departure - a.departure)[0];
        
        // Find next stop
        const nextStop = [...routeData]
            .filter(stop => now < new Date(stop.arrival * 1000))
            .sort((a, b) => a.arrival - b.arrival)[0];
        
        // During the journey
        const currentStop = routeData.find(stop => 
            now >= new Date(stop.arrival * 1000) && 
            now < new Date(stop.departure * 1000)
        );
       
        
        // Update last seen location
        if (lastStop) {
            lastSeenValue.textContent = `${getRegionFlag(lastStop.Region)} ${lastStop.City}, ${lastStop.Region}`;
        }
        
        // Calculate and update basket and carrot counts
        const newBasketCount = calculateCurrentBaskets(now, currentStop, lastStop, nextStop);
        const newCarrotCount = calculateCurrentCarrots(now, currentStop, lastStop, nextStop);
        
        
if (lastStop && lastStop.City === "Easter Bunny's Workshop") {
    const presentsValue = document.getElementById('presentsValue');
    const cookiesValue = document.getElementById('cookiesValue');

    // Set the text content to "Currently unavailable"
    presentsValue.textContent = "❌ Currently unavailable (tracking baskets delivered starts soon)";
    cookiesValue.textContent = "❌ Currently unavailable (tracking carrots eaten starts soon)";

    // Skip the update logic for basket and carrot counts
} else {
    if (newBasketCount !== targetBasketCount || newCarrotCount !== targetCarrotCount) {
        targetBasketCount = newBasketCount;
        targetCarrotCount = newCarrotCount;
        updateCounterDisplays(newBasketCount, newCarrotCount);
    }
}

        
        if (currentStop) {
            // At a stop
            // At a stop - speed is 0
            speedBuffer = []; // Clear speed buffer
            updateSpeedDisplay(0);


            const position = [parseFloat(currentStop.Latitude), parseFloat(currentStop.Longitude)];
            checkWeatherUpdate(position[0], position[1]);
            
            updateTotalDistance(position[0], position[1]);
            bunnyMarker.setLatLng(position);
            
            if (isMapLocked) {
                map.setView(position, map.getZoom(), {animate: false});
            }
            
            currentStopLabel.innerHTML = '<span class="material-symbols-rounded">location_on</span> Current stop';
            currentStopValue.textContent = `${getRegionFlag(currentStop.Region)} ${currentStop.City}, ${currentStop.Region}`;
            departingLabel.innerHTML = '<span class="material-icons">flight_takeoff</span> Departing in';
            
            const countdown = Math.max(0, Math.floor((currentStop.departure * 1000 - now) / 1000));
            departingValue.textContent = formatCountdown(countdown);
        } else if (lastStop && nextStop) {
            // In transit
            const timeProgress = (now - lastStop.departure * 1000) / 
                               (nextStop.arrival * 1000 - lastStop.departure * 1000);
            
            const lat = parseFloat(lastStop.Latitude) + 
                       (timeProgress * (parseFloat(nextStop.Latitude) - parseFloat(lastStop.Latitude)));
            const lng = parseFloat(lastStop.Longitude) + 
                       (timeProgress * (parseFloat(nextStop.Longitude) - parseFloat(lastStop.Longitude)));

            checkWeatherUpdate(lat, lng);

            // Calculate and update current speed
            const currentSpeed = calculateCurrentSpeed(lat, lng, now.getTime());
            updateSpeedDisplay(currentSpeed);
            
            const position = [lat, lng];
            
            updateTotalDistance(lat, lng);
            bunnyMarker.setLatLng(position);
            
            if (isMapLocked) {
                map.setView(position, map.getZoom(), {animate: false});
            }
            
            currentStopLabel.innerHTML = '<span class="material-symbols-rounded">directions</span> Next stop';
            currentStopValue.textContent = `${getRegionFlag(nextStop.Region)} ${nextStop.City}, ${nextStop.Region}`;
            departingLabel.innerHTML = '<span class="material-icons">flight_land</span> Arriving in';
            
            const countdown = Math.max(0, Math.floor((nextStop.arrival * 1000 - now) / 1000));
            departingValue.textContent = formatCountdown(countdown);
        }
    } catch (error) {
        console.error(`❌ [${formattedTime}] Error in updateBunnyLocation:`, error);
        console.error('Stack trace:', error.stack);
    }
}

// Fullscreen toggle function 🖥️
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Lock toggle function with map control 🔒
function toggleLock(button) {
    const icon = button.querySelector('.material-symbols-rounded');
    if (icon.textContent === 'lock') {
        // Unlock the map
        icon.textContent = 'lock_open';
        isMapLocked = false;
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        if (map.tap) map.tap.enable();
    } else {
        // Lock the map
        icon.textContent = 'lock';
        isMapLocked = true;
        // Center on bunny
        map.setView(bunnyMarker.getLatLng(), map.getZoom());
        // Disable map interactions except zoom controls
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        if (map.tap) map.tap.disable();
    }
}

// Initialize tracking system 🚀
async function initializeTracking() {
    const success = await fetchRouteData();
    await fetchPreTrackingData();
    
    if (success) {
        // Initialize markers - now with await
        await initializeDestinationMarkers(); // 🔄 Added await here!
        
        // Update location and markers immediately
        updatePreTrackingStatus(getCurrentDateTime());
        updateBunnyLocation();
        updateMarkerStates();
        
// Add this to your existing update cycle in initializeTracking
setInterval(() => {
    const now = getCurrentDateTime();
    updatePreTrackingStatus(now);
    updateBunnyLocation();
    updateMarkerStates();
    updateLocalTime(); // Add this line to update the time every second
}, 1000);

        
        console.log('🎯 Tracking system and markers initialized!');
    }
}

// Start the tracking system
initializeTracking();

// Loading messages array
const loadingMessages = [
    "Connecting to Easter Island... 🏝️",
    "Checking the Easter Bunny's GPS coordinates... 📍",
    "Loading basket delivery data... 🧺",
    "Counting carrots and calculating routes... 🥕",
    "Syncing with time zones around the world... 🌍",
    "Warming up the map engines... 🗺️",
    "Almost ready to track some Easter magic! ✨"
];

// Simulate loading progress
let progress = 0;
const progressBar = document.getElementById("progressBar");
const loadingMessage = document.getElementById("loadingMessage");

function updateProgress() {
    progress += 10; // Increment progress
    progressBar.style.width = progress + "%";
    
    // Update message based on progress
    const messageIndex = Math.floor((progress / 100) * (loadingMessages.length - 1));
    loadingMessage.textContent = loadingMessages[messageIndex];
    
    if (progress < 100) {
        setTimeout(updateProgress, 500); // Update every 0.5 seconds
    } else {
        // Show final message before fade out
        loadingMessage.textContent = "Ready to hop into action! 🐰✨";
        finishLoading();
    }
}

// Function to finish loading and show the tracker
function finishLoading() {
    const loadingScreen = document.getElementById("loadingScreen");
    const tracker = document.getElementById("tracker");
    
    loadingScreen.classList.add("fade-out"); // Add fade-out class
    setTimeout(() => {
        loadingScreen.style.display = "none"; // Hide loading screen
        tracker.style.display = "block"; // Show tracker
    }, 2000); // Wait for fade-out transition to finish
}

// Start loading process
updateProgress();

function applyDarkMode(enabled) {
    if (enabled) {
        document.documentElement.setAttribute('data-theme', 'dark');
        map.removeLayer(currentTileLayer);
        currentTileLayer = darkTileLayer;
        currentTileLayer.addTo(map);
        
        // Update map elements for dark mode
        const popupWrappers = document.querySelectorAll('.leaflet-popup-content-wrapper');
        const popupTips = document.querySelectorAll('.leaflet-popup-tip');
        const popupContents = document.querySelectorAll('.leaflet-popup-content');
        const tooltips = document.querySelectorAll('.leaflet-tooltip');
        
        popupWrappers.forEach(wrapper => {
            wrapper.style.backgroundColor = 'var(--popup-background)';
        });
        
        popupTips.forEach(tip => {
            tip.style.backgroundColor = 'var(--popup-background)';
        });
        
        popupContents.forEach(content => {
            content.style.color = 'var(--text-primary)';
        });

        tooltips.forEach(tooltip => {
            tooltip.style.backgroundColor = 'var(--tooltip-background)';
            tooltip.style.color = 'var(--text-primary)';
            tooltip.style.borderColor = 'var(--card-border)';
        });
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        map.removeLayer(currentTileLayer);
        currentTileLayer = lightTileLayer;
        currentTileLayer.addTo(map);
        
        // Reset map elements to default
        const popupWrappers = document.querySelectorAll('.leaflet-popup-content-wrapper');
        const popupTips = document.querySelectorAll('.leaflet-popup-tip');
        const popupContents = document.querySelectorAll('.leaflet-popup-content');
        const tooltips = document.querySelectorAll('.leaflet-tooltip');
        
        popupWrappers.forEach(wrapper => {
            wrapper.style.backgroundColor = '';
        });
        
        popupTips.forEach(tip => {
            tip.style.backgroundColor = '';
        });
        
        popupContents.forEach(content => {
            content.style.color = '';
        });

        tooltips.forEach(tooltip => {
            tooltip.style.backgroundColor = '';
            tooltip.style.color = '';
            tooltip.style.borderColor = '';
        });
    }
}

function saveSettings() {
    localStorage.setItem('bunnyTrackerSettings', JSON.stringify(settings));
    updateMetricsVisibility(); // Add this line
}

// Update the settings UI based on saved settings
function updateSettingsUI() {
    // Update metrics checkboxes
    document.getElementById('setting-location-info').checked = settings.metrics.locationInfo;
    document.getElementById('setting-delivery-stats').checked = settings.metrics.deliveryStats;
    document.getElementById('setting-island-status').checked = settings.metrics.islandStatus;
    document.getElementById('setting-arrival-time').checked = settings.metrics.arrivalTime;
    document.getElementById('setting-additional-stats').checked = settings.metrics.additionalStats;

    // Update units radio buttons
    document.getElementById('setting-metric').checked = settings.units === 'metric';
    document.getElementById('setting-imperial').checked = settings.units === 'imperial';

    // Update temperature radio buttons
    document.getElementById('setting-celsius').checked = settings.temperature === 'celsius';
    document.getElementById('setting-fahrenheit').checked = settings.temperature === 'fahrenheit';

    // Update dark mode checkbox
    document.getElementById('setting-dark-mode').checked = settings.darkMode;
}


function toggleSettings() {
    const backdrop = document.querySelector('.modal-backdrop');
    const popup = document.querySelector('.settings-popup');
    
    if (popup.style.display === 'block') {
        backdrop.classList.remove('active');
        popup.classList.remove('active');
        setTimeout(() => {
            backdrop.style.display = 'none';
            popup.style.display = 'none';
        }, 300);
    } else {
        backdrop.style.display = 'block';
        popup.style.display = 'block';
        // Force reflow
        popup.offsetHeight;
        backdrop.classList.add('active');
        popup.classList.add('active');
    }
}

// Update your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initializeMap();
    updateSettingsUI();
    updateMetricsVisibility();

    // Close button and backdrop click handlers
    document.querySelector('.settings-close').addEventListener('click', toggleSettings);
    document.querySelector('.modal-backdrop').addEventListener('click', toggleSettings);

    // Stop propagation on popup click to prevent closing when clicking inside
    document.querySelector('.settings-popup').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    const metricIds = ['location-info', 'delivery-stats', 'island-status', 'arrival-time', 'additional-stats'];
    metricIds.forEach(id => {
        document.getElementById(`setting-${id}`).addEventListener('change', (e) => {
            const settingKey = id.split('-').map((word, index) => 
                index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
            ).join('');
            settings.metrics[settingKey] = e.target.checked;
            saveSettings();
        });
    });

    // Units radio buttons
    document.getElementById('setting-metric').addEventListener('change', (e) => {
        if (e.target.checked) {
            settings.units = 'metric';
            saveSettings();
        }
    });

    document.getElementById('setting-imperial').addEventListener('change', (e) => {
        if (e.target.checked) {
            settings.units = 'imperial';
            saveSettings();
        }
    });

    // Temperature radio buttons
    document.getElementById('setting-celsius').addEventListener('change', (e) => {
        if (e.target.checked) {
            settings.temperature = 'celsius';
            saveSettings();
        }
    });

    document.getElementById('setting-fahrenheit').addEventListener('change', (e) => {
        if (e.target.checked) {
            settings.temperature = 'fahrenheit';
            saveSettings();
        }
    });
    // Add dark mode listener
    document.getElementById('setting-dark-mode').addEventListener('change', (e) => {
        settings.darkMode = e.target.checked;
        applyDarkMode(e.target.checked);
        saveSettings();
    });
});

function updateMetricsVisibility() {
    // Location info (stops & timing)
    const stopDetailsCard = document.querySelector('.stop-details-card');
    if (stopDetailsCard) {
        stopDetailsCard.style.display = settings.metrics.locationInfo ? 'block' : 'none';
    }

    // Delivery stats (baskets & carrots)
    const presentsStats = document.querySelector('.presents-cookies');
    if (presentsStats) {
        presentsStats.style.display = settings.metrics.deliveryStats ? 'block' : 'none';
    }

    // Status stat contains Easter Island status
    const statusStat = document.querySelector('.status-stat');
    if (statusStat) {
        statusStat.style.display = settings.metrics.islandStatus ? 'block' : 'none';
    }

    // Estimated arrival time
    const arrivalStat = document.querySelector('.arrival-stat');
    if (arrivalStat) {
        arrivalStat.style.display = settings.metrics.arrivalTime ? 'block' : 'none';
    }

    // Additional stats (distance/speed/weather)
    const extraStats = document.querySelector('.extra-stats');
    if (extraStats) {
        extraStats.style.display = settings.metrics.additionalStats ? 'block' : 'none';
    }
}


function toggleInfo() {
    const infoPopup = document.getElementById('infoPopup');
    const infoBackdrop = document.getElementById('infoBackdrop');
    const isOpen = infoPopup.style.display === 'block';

    if (isOpen) {
        // Close popup
        infoBackdrop.classList.remove('active');
        infoPopup.classList.remove('active');
        setTimeout(() => {
            infoBackdrop.style.display = 'none';
            infoPopup.style.display = 'none';
        }, 300);
    } else {
        // Open popup
        infoBackdrop.style.display = 'block';
        infoPopup.style.display = 'block';
        setTimeout(() => {
            infoBackdrop.classList.add('active');
            infoPopup.classList.add('active');
        }, 10);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const infoBackdrop = document.getElementById('infoBackdrop');
    const closeInfoBtn = document.getElementById('closeInfoBtn');

    // Close handlers
    closeInfoBtn.addEventListener('click', toggleInfo);
    infoBackdrop.addEventListener('click', toggleInfo);
});

let countdownDismissed = false;

function calculateEaster(year) {
    // Meeus/Jones/Butcher algorithm for calculating Easter
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    return new Date(Date.UTC(year, month - 1, day));
}

function getEasterEveDate(year) {
    const easterSunday = calculateEaster(year);
    const easterEve = new Date(easterSunday);
    easterEve.setDate(easterEve.getDate() - 1);
    easterEve.setUTCHours(10, 00, 0, 0); // Set to 8:30 AM UTC
    return easterEve;
}

function getTrackingEndDate(easterEve) {
    // Tracking ends 1 day after Easter Eve
    const endDate = new Date(easterEve);
    endDate.setDate(endDate.getDate() + 1);
    return endDate;
}

function getNextTrackingYear(now) {
    const currentYear = now.getFullYear();
    const currentEasterEve = getEasterEveDate(currentYear);
    const trackingEndDate = getTrackingEndDate(currentEasterEve);
    
    // If we're more than a week after tracking end date, show countdown for next year
    const oneWeekAfterEnd = new Date(trackingEndDate);
    oneWeekAfterEnd.setDate(oneWeekAfterEnd.getDate() + 7);
    
    if (now >= oneWeekAfterEnd) {
        return currentYear + 1;
    }
    return currentYear;
}

function updateCountdown() {
    const now = getCurrentDateTime();
    const targetYear = getNextTrackingYear(now);
    const startDate = getEasterEveDate(targetYear);
    const timeLeft = startDate - now;

    if (timeLeft > 0) {
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        document.getElementById('countDays').textContent = String(days).padStart(2, '0');
        document.getElementById('countHours').textContent = String(hours).padStart(2, '0');
        document.getElementById('countMinutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('countSeconds').textContent = String(seconds).padStart(2, '0');

        const headerText = targetYear > now.getFullYear() 
            ? `until the Easter Bunny's ${targetYear} journey begins ⏳`
            : `until the Easter Bunny's journey begins ⏳`;
        document.querySelector('.countdown-container h3').textContent = headerText;
    }
}

function toggleCountdown() {
    const overlay = document.getElementById('countdownOverlay');
    if (overlay.style.display === 'none') {
        overlay.style.display = 'flex';
        overlay.classList.remove('hiding');
        // Start updating the countdown
        updateCountdown();
        window.countdownInterval = setInterval(updateCountdown, 1000);
    } else {
        overlay.classList.add('hiding');
        setTimeout(() => {
            overlay.style.display = 'none';
            // Clear the interval when hiding
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }
        }, 500);
    }
}

function dismissCountdown() {
    countdownDismissed = true;
    const overlay = document.getElementById('countdownOverlay');
    overlay.classList.add('hiding');
    // Clear the interval when dismissing
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 500);
}

// Initialize with countdown hidden
const overlay = document.getElementById('countdownOverlay');
if (overlay) {
    overlay.style.display = 'none';
}

// Register service worker for offline support 🚀
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('🎯 Service Worker registered successfully:', registration.scope);
      })
      .catch(error => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

// Function to update weather stat when offline
function updateWeatherOffline() {
  const weatherStat = document.querySelector('.weather-stat');
  if (weatherStat) {
    weatherStat.textContent = '❌ Weather unavailable offline';
  }
}

// Function to show offline notification
function showOfflineNotification() {
  const notificationText = document.createElement('div');
  notificationText.id = 'offline-notification';
  notificationText.innerHTML = `
    <span class="material-symbols-rounded">cloud_off</span>
    <span>You're offline, but you can still track the Easter Bunny with a little magic! 📶📴✨</span>
    <span class="material-symbols-rounded close-icon">close</span>
  `;
  document.querySelector('.header').insertAdjacentElement('afterend', notificationText);

  // Add event listener to the close icon
  document.querySelector('.close-icon').addEventListener('click', () => {
    const notification = document.getElementById('offline-notification');
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 500); // Adjust the duration to match the CSS transition
  });
}

// Check if offline on initial load
if (!navigator.onLine) {
  updateWeatherOffline();
  showOfflineNotification();
}

// Add event listeners for online/offline status changes
window.addEventListener('offline', () => {
  updateWeatherOffline();
  showOfflineNotification();
});
window.addEventListener('online', () => {
  const notificationBar = document.getElementById('offline-notification');
  if (notificationBar) {
    notificationBar.remove();
    document.body.classList.remove('offline-mode');
  }
});
