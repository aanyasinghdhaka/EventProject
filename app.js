const userBackendUrl = "http://127.0.0.1:5000/events";
const adminBackendUrl = "http://127.0.0.1:5000/admin";
const bookingUrl = "http://127.0.0.1:5000/bookings";
const userId = 1;

let isAdmin = false;
let selectedEventId = null;
let selectedSeatNumbers = []; // Corrected: This is now an array for multiple seats

// --- Modal Elements ---
const seatModal = document.getElementById('seat-modal');
const closeModalButton = document.querySelector('.close-button');
const modalEventName = document.getElementById('modal-event-name');
const seatGrid = document.getElementById('seat-grid');
const confirmSeatBookingBtn = document.getElementById('confirm-seat-booking-btn');

// --- Rendering Functions ---

function renderUserView(events) {
    const eventList = document.getElementById('user-event-list');
    eventList.innerHTML = '';
    events.forEach(event => {
        const seatsLeft = event.total_capacity - event.tickets_booked;
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <strong>${event.name}</strong> | Venue: ${event.venue} | Time: ${event.start_time} | Seats Left: ${seatsLeft}
            <button onclick="openSeatModal(${event.id}, '${event.name}')">Book Ticket</button>
        `;
        eventList.appendChild(listItem);
    });
}

function renderAdminView(events, analytics) {
    const analyticsDiv = document.getElementById('admin-analytics');
    analyticsDiv.innerHTML = `
        <h3>Analytics</h3>
        <p><strong>Total Bookings:</strong> ${analytics.total_bookings}</p>
        <p><strong>Most Popular Events:</strong></p>
        <ul>
            ${analytics.most_popular_events.map(e => `<li>${e.event_name}: ${e.booking_count} bookings</li>`).join('')}
        </ul>
    `;

    const eventList = document.getElementById('admin-event-list');
    eventList.innerHTML = '';
    events.forEach(event => {
        const seatsBooked = event.tickets_booked;
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <strong>${event.name}</strong> | Booked: ${seatsBooked} | Capacity: ${event.total_capacity}
            <button onclick="deleteEvent(${event.id})">Delete</button>
            <button onclick="generateSeats(${event.id})">Generate Seats</button>
        `;
        eventList.appendChild(listItem);
    });
}

function showUserMode() {
    document.getElementById('user-mode').style.display = 'block';
    document.getElementById('admin-mode').style.display = 'none';
    document.getElementById('switch-mode-btn').textContent = 'Switch to Admin Mode';
    isAdmin = false;
    fetchEvents();
}

function showAdminMode() {
    document.getElementById('user-mode').style.display = 'none';
    document.getElementById('admin-mode').style.display = 'block';
    document.getElementById('switch-mode-btn').textContent = 'Switch to User Mode';
    isAdmin = true;
    fetchAdminData();
}

// --- Seat Modal Functions ---

function openSeatModal(eventId, eventName) {
    selectedEventId = eventId;
    selectedSeatNumbers = []; // Corrected: This is now an array for multiple seats
    modalEventName.textContent = eventName;
    confirmSeatBookingBtn.style.display = 'none';
    fetchAndRenderSeats(eventId);
    seatModal.style.display = 'block';
}

function closeSeatModal() {
    seatModal.style.display = 'none';
}

function fetchAndRenderSeats(eventId) {
    fetch(`${userBackendUrl}/${eventId}/seats`)
        .then(response => response.json())
        .then(seats => {
            seatGrid.innerHTML = '';
            if (seats.error) {
                seatGrid.innerHTML = `<p>${seats.error}</p>`;
                return;
            }
            seats.forEach(seat => {
                const seatElement = document.createElement('div');
                seatElement.classList.add('seat');
                seatElement.textContent = seat.seat_number;

                if (seat.is_available) {
                    seatElement.classList.add('available');
                    seatElement.onclick = () => selectSeat(seat.seat_number, seatElement);
                } else {
                    seatElement.classList.add('booked');
                }
                seatGrid.appendChild(seatElement);
            });
        })
        .catch(error => {
            console.error("Error fetching seats:", error);
            seatGrid.innerHTML = '<p>Could not load seats.</p>';
        });
}

function selectSeat(seatNumber, seatElement) {
    if (seatElement.classList.contains('selected')) {
        // Deselect seat
        seatElement.classList.remove('selected');
        selectedSeatNumbers = selectedSeatNumbers.filter(s => s !== seatNumber);
    } else {
        // Select seat
        seatElement.classList.add('selected');
        selectedSeatNumbers.push(seatNumber);
    }
    
    // Show/hide confirm button based on selection
    if (selectedSeatNumbers.length > 0) {
        confirmSeatBookingBtn.style.display = 'block';
    } else {
        confirmSeatBookingBtn.style.display = 'none';
    }
}


// --- API Calls ---

function fetchEvents(searchTerm = '') {
    let url = userBackendUrl;
    if (searchTerm) {
        url += `?search=${searchTerm}`;
    }
    fetch(url)
        .then(response => response.json())
        .then(data => renderUserView(data))
        .catch(error => console.error("Error fetching events:", error));
}

function fetchAdminData() {
    Promise.all([
        fetch(userBackendUrl).then(res => res.json()),
        fetch(`${adminBackendUrl}/analytics`).then(res => res.json())
    ]).then(([events, analytics]) => {
        renderAdminView(events, analytics);
    }).catch(error => {
        console.error("Error fetching admin data:", error);
    });
}

function bookSelectedSeats() {
    if (selectedSeatNumbers.length === 0) {
        alert("Please select at least one seat.");
        return;
    }

    fetch(bookingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: userId,
            event_id: selectedEventId,
            seat_numbers: selectedSeatNumbers // Send the array of seats
        }),
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message || data.error);
        closeSeatModal(); // Close modal after booking attempt
        fetchEvents(); // Refresh event list
        if (isAdmin) fetchAdminData(); // Refresh admin view if in admin mode
    })
    .catch(error => {
        console.error("Error booking seats:", error);
        alert("Booking failed due to a network error.");
    });
}

function deleteEvent(eventId) {
    const confirmed = confirm("Are you sure you want to delete this event?");
    if (confirmed) {
        fetch(`${adminBackendUrl}/events/${eventId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (response.ok) {
                alert('Event deleted successfully!');
                fetchAdminData();
            } else {
                alert('Failed to delete event.');
            }
        })
        .catch(error => {
            console.error("Error deleting event:", error);
            alert("Deletion failed.");
        });
    }
}

function generateSeats(eventId) {
    const confirmed = confirm("Are you sure you want to generate seats for this event? This cannot be undone.");
    if (confirmed) {
        fetch(`${adminBackendUrl}/events/${eventId}/generate-seats`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message || data.error);
            fetchAdminData();
        })
        .catch(error => {
            console.error("Error generating seats:", error);
            alert("Failed to generate seats.");
        });
    }
}



// --- Event Listeners ---

document.getElementById('user-search-button').addEventListener('click', () => {
    const searchTerm = document.getElementById('user-search-input').value;
    fetchEvents(searchTerm);
});

document.getElementById('switch-mode-btn').addEventListener('click', () => {
    if (isAdmin) {
        showUserMode();
    } else {
        const password = prompt("Enter admin password:");
        if (password === "eventlyadmin") {
            showAdminMode();
        } else if (password !== null) {
            alert("Incorrect password.");
        }
    }
});

document.getElementById('create-event-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('event-name').value;
    const venue = document.getElementById('event-venue').value;
    const startTime = document.getElementById('event-start-time').value;
    const capacity = document.getElementById('event-capacity').value;

    fetch(`${adminBackendUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            venue,
            start_time: startTime + ":00Z",
            total_capacity: parseInt(capacity)
        }),
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message || data.error);
        document.getElementById('create-event-form').reset();
        fetchAdminData();
    })
    .catch(error => {
        console.error("Error creating event:", error);
        alert("Failed to create event.");
    });
});

closeModalButton.addEventListener('click', closeSeatModal);
window.addEventListener('click', (event) => {
    if (event.target == seatModal) {
        closeSeatModal();
    }
});

confirmSeatBookingBtn.addEventListener('click', bookSelectedSeats);


// Initial load
showUserMode();