// Test mode toggle - keeping this from your original code 🧪
const TEST_MODE = false;

// Helper function to get current date/time (real or test mode) 🕒
function getCurrentDateTime() {
    let now = new Date();
    if (TEST_MODE) {
        return new Date(
            now.getFullYear(),
            3,                  // April (0-based)
            19,                // 19th
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds()
        );
    }
    return now;
}

// Get current and next year's Easter Eve dates
function getEasterDates() {
    const currentDate = getCurrentDateTime();
    const currentYear = currentDate.getFullYear();
    
    // Calculate this year's Easter Eve
    const easterEveDate = getEasterEveDate(currentYear);
    // Calculate next year's Easter Eve
    const nextYearEasterEveDate = getEasterEveDate(currentYear + 1);
    
    return {
        easterEveDate,
        nextYearEasterEveDate
    };
}

// Helper function to calculate Easter Eve for a given year
function getEasterEveDate(year) {
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
    
    // Create Easter Sunday date and set to 10:00 UTC
    const easterSunday = new Date(Date.UTC(year, month - 1, day));
    // Get Easter Eve (day before Easter Sunday)
    const easterEve = new Date(easterSunday);
    easterEve.setDate(easterEve.getDate() - 1);
    easterEve.setUTCHours(10, 0, 0, 0);
    
    return easterEve;
}

// Calculate distance between points (keeping your original function) 🗺️
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
             Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Main API function that generates the JSON response 📊
async function generateBunnyAPI() {
    try {
        // Fetch route data 🗺️
        const response = await fetch('https://api.npoint.io/adf585d984bb6a571cb7');
        const data = await response.json();
        
        // Calculate route start times dynamically based on Easter Eve dates ✨
        const baseRouteEasterEve = getEasterEveDate(2023); // Original route data from 2023
        const { easterEveDate: currentYearEasterEve } = getEasterDates();
        
        // Calculate time difference between original route and current year
        const timeDifferenceSeconds = Math.floor(
            (currentYearEasterEve.getTime() - baseRouteEasterEve.getTime()) / 1000
        );
        
        // Process route data with dynamic year adjustment
        const routeData = data.route.map(stop => ({
            ...stop,
            arrival: parseInt(stop["Unix Arrival"]) + timeDifferenceSeconds,
            departure: parseInt(stop["Unix Arrival"]) + timeDifferenceSeconds + parseInt(stop["Arrival Stoppage Time"]),
            basketsDelivered: Math.ceil(parseInt(stop["Eggs Delivered"]) * 1.25),
            carrotsEaten: Math.ceil(parseInt(stop["Carrots eaten"]) * 1.25)
        }));

        const now = getCurrentDateTime();
        
        // Find current location and status 📍
        const currentStop = routeData.find(stop => 
            now >= new Date(stop.arrival * 1000) && 
            now < new Date(stop.departure * 1000)
        );
        
        const lastStop = [...routeData]
            .filter(stop => now >= new Date(stop.departure * 1000))
            .sort((a, b) => b.departure - a.departure)[0];
            
        const nextStop = [...routeData]
            .filter(stop => now < new Date(stop.arrival * 1000))
            .sort((a, b) => a.arrival - b.arrival)[0];

        // Calculate current position 🎯
        let currentPosition, status, relevantStop, arrivalDepartureTime;
        const { easterEveDate, nextYearEasterEveDate } = getEasterDates();
        
        if (now < easterEveDate) {
            // Pre-journey - at Easter Island
            currentPosition = {
                latitude: -27.1044228,
                longitude: -109.2489683
            };
            status = "stopped";
            relevantStop = {
                City: "Easter Bunny's Workshop",
                Region: "Easter Island, Chile"
            };
            arrivalDepartureTime = Math.floor(easterEveDate.getTime() / 1000);
        } else if (!currentStop && !nextStop && lastStop?.City === routeData[routeData.length - 1].City) {
            // Post-journey - back at Easter Island
            currentPosition = {
                latitude: -27.1044228,
                longitude: -109.2489683
            };
            status = "stopped";
            relevantStop = {
                City: "Easter Bunny's Workshop",
                Region: "Easter Island, Chile"
            };
            arrivalDepartureTime = Math.floor(nextYearEasterEveDate.getTime() / 1000);
        } else if (currentStop) {
            // At a stop
            currentPosition = {
                latitude: parseFloat(currentStop.Latitude),
                longitude: parseFloat(currentStop.Longitude)
            };
            status = "stopped";
            relevantStop = currentStop;
            arrivalDepartureTime = currentStop.departure;
        } else if (lastStop && nextStop) {
            // In transit
            const timeProgress = (now - lastStop.departure * 1000) / 
                               (nextStop.arrival * 1000 - lastStop.departure * 1000);
            
            const lat = parseFloat(lastStop.Latitude) + 
                       (timeProgress * (parseFloat(nextStop.Latitude) - parseFloat(lastStop.Latitude)));
            const lng = parseFloat(lastStop.Longitude) + 
                       (timeProgress * (parseFloat(nextStop.Longitude) - parseFloat(lastStop.Longitude)));
            
            currentPosition = {
                latitude: lat,
                longitude: lng
            };
            status = "en-route";
            relevantStop = nextStop;
            arrivalDepartureTime = nextStop.arrival;
        }

        // Calculate stats 📊
        let basketsDelivered = 0;
        let carrotsEaten = 0;
        let totalDistance = 0;
        
        // Pre-journey checks
        if (now < easterEveDate) {
            basketsDelivered = 0;
            carrotsEaten = 0;
        } 
        // Post-journey checks
        else if (!currentStop && !nextStop && lastStop?.City === routeData[routeData.length - 1].City) {
            basketsDelivered = 7706250000;
            carrotsEaten = routeData[routeData.length - 1].carrotsEaten;
        }
        // During journey calculations
        else if (lastStop) {
            if (currentStop) {
                const progress = (now - new Date(currentStop.arrival * 1000)) / 
                               (new Date(currentStop.departure * 1000) - new Date(currentStop.arrival * 1000));
                const currentStopBaskets = currentStop.basketsDelivered - (lastStop?.basketsDelivered || 0);
                basketsDelivered = Math.round(lastStop.basketsDelivered + (currentStopBaskets * progress));
                carrotsEaten = Math.round(lastStop.carrotsEaten + 
                              ((currentStop.carrotsEaten - lastStop.carrotsEaten) * progress));
            } else if (nextStop) {
                const progress = (now - new Date(lastStop.departure * 1000)) / 
                               (new Date(nextStop.arrival * 1000) - new Date(lastStop.departure * 1000));
                basketsDelivered = Math.round(lastStop.basketsDelivered + 
                                 ((nextStop.basketsDelivered - lastStop.basketsDelivered) * progress));
                carrotsEaten = Math.round(lastStop.carrotsEaten + 
                             ((nextStop.carrotsEaten - lastStop.carrotsEaten) * progress));
            }
        }

        // Calculate total distance travelled 🗺️
        let lastPosition = [-27.1044228, -109.2489683]; // Easter Island starting point
        
        for (const stop of routeData) {
            if (new Date(stop.arrival * 1000) > now) break;
            
            const stopPos = [parseFloat(stop.Latitude), parseFloat(stop.Longitude)];
            totalDistance += calculateDistance(
                lastPosition[0], lastPosition[1],
                stopPos[0], stopPos[1]
            );
            lastPosition = stopPos;
        }

        // If in transit, add distance to current position
        if (status === "en-route") {
            totalDistance += calculateDistance(
                lastPosition[0], lastPosition[1],
                currentPosition.latitude, currentPosition.longitude
            );
        }

        // Create API response ✨
        const apiResponse = {
            status: status,
            location: currentPosition,
            stop: {
                city: relevantStop.City,
                region: relevantStop.Region
            },
            arrival_departure_time: arrivalDepartureTime,
            stats: {
                baskets_delivered: Math.round(basketsDelivered),
                carrots_eaten: Math.round(carrotsEaten),
                distance_travelled_km: Math.round(totalDistance),
                distance_travelled_m: Math.round(totalDistance * 0.621371)
            }
        };

        // Set proper JSON headers
        document.head.innerHTML = '';  // Clear any default headers
        const headers = document.createElement('meta');
        headers.httpEquiv = 'Content-Type';
        headers.content = 'application/json; charset=utf-8';
        document.head.appendChild(headers);

        // Return JSON response properly
        const jsonResponse = JSON.stringify(apiResponse, null, 2);
        document.body.textContent = jsonResponse;  // This is cleaner than document.write
    } catch (error) {
        // Set error headers
        document.head.innerHTML = '';
        const headers = document.createElement('meta');
        headers.httpEquiv = 'Content-Type';
        headers.content = 'application/json; charset=utf-8';
        document.head.appendChild(headers);

        // Return error JSON
        const errorResponse = JSON.stringify({
            error: "Failed to generate Easter Bunny tracking data",
            details: error.message
        }, null, 2);
        document.body.textContent = errorResponse;
    }
}

// Generate API response when loaded 🚀
window.addEventListener('load', generateBunnyAPI);
