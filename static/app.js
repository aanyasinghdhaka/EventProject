const userBackendUrl = "https://asd-evently-backend.onrender.com/events";
const adminBackendUrl = "https://asd-evently-backend.onrender.com/admin";
const bookingUrl = "https://asd-evently-backend.onrender.com/bookings";
const userId = 1;

let isAdmin = false;
let selectedEventId = null;
let selectedSeatNumbers = [];

// --- All functions must be defined in the global scope ---
// --- so they can be called from within the HTML or other functions ---

function renderUserView(events) {
    const eventList = document.getElementById('user-event-list');
    eventList.innerHTML = '';
    events.forEach(event => {
        const seatsLeft = event.total_capacity - event.tickets_booked;
        const listItem = document.createElement('li');
        // FIX: The HTML onclick attribute needs access to a global function,
        // so it cannot be inside the DOMContentLoaded block.
        // The original code was the correct way to do this.
        listItem.innerHTML = `
            <strong>${event.name}</strong> | Venue: ${event.venue} | Time: ${event.start_time} | Seats Left: ${seatsLeft}
            <button onclick="openSeatModal(${event.id}, '${event.name}')">Book Ticket</button>
        `;
        eventList.appendChild(listItem);
    });
}

// FIX: Remove the bookButtons logic from here, as it's not needed with onclick
// It was the source of the initial TypeError but you have a new one now.

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
    const switchModeBtn = document.getElementById('switch-mode-btn'); // FIX: moved inside the function to avoid null error
    switchModeBtn.textContent = 'Switch to Admin Mode';
    isAdmin = false;
    fetchEvents();
}

function showAdminMode() {
    document.getElementById('user-mode').style.display = 'none';
    document.getElementById('admin-mode').style.display = 'block';
    const switchModeBtn = document.getElementById('switch-mode-btn'); // FIX: moved inside the function to avoid null error
    switchModeBtn.textContent = 'Switch to User Mode';
    isAdmin = true;
    fetchAdminData();
}

function openSeatModal(eventId, eventName) {
    selectedEventId = eventId;
    selectedSeatNumbers = [];
    const modalEventName = document.getElementById('modal-event-name'); // FIX: moved inside the function to avoid null error
    modalEventName.textContent = eventName;
    const confirmSeatBookingBtn = document.getElementById('confirm-seat-booking-btn'); // FIX: moved inside the function to avoid null error
    confirmSeatBookingBtn.style.display = 'none';
    fetchAndRenderSeats(eventId);
    const seatModal = document.getElementById('seat-modal'); // FIX: moved inside the function to avoid null error
    seatModal.style.display = 'block';
}

function closeSeatModal() {
    const seatModal = document.getElementById('seat-modal'); // FIX: moved inside the function to avoid null error
    seatModal.style.display = 'none';
}

function fetchAndRenderSeats(eventId) {
    fetch(`${userBackendUrl}/${eventId}/seats`)
        .then(response => response.json())
        .then(seats => {
            const seatGrid = document.getElementById('seat-grid'); // FIX: moved inside the function to avoid null error
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
            const seatGrid = document.getElementById('seat-grid'); // FIX: moved inside the function to avoid null error
            seatGrid.innerHTML = '<p>Could not load seats.</p>';
        });
}

function selectSeat(seatNumber, seatElement) {
    if (seatElement.classList.contains('selected')) {
        seatElement.classList.remove('selected');
        selectedSeatNumbers = selectedSeatNumbers.filter(s => s !== seatNumber);
    } else {
        seatElement.classList.add('selected');
        selectedSeatNumbers.push(seatNumber);
    }
    
    if (selectedSeatNumbers.length > 0) {
        const confirmSeatBookingBtn = document.getElementById('confirm-seat-booking-btn'); // FIX: moved inside the function to avoid null error
        confirmSeatBookingBtn.style.display = 'block';
    } else {
        const confirmSeatBookingBtn = document.getElementById('confirm-seat-booking-btn'); // FIX: moved inside the function to avoid null error
        confirmSeatBookingBtn.style.display = 'none';
    }
}

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
            seat_numbers: selectedSeatNumbers
        }),
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message || data.error);
        closeSeatModal();
        fetchEvents();
        if (isAdmin) fetchAdminData();
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

function createEvent(eventData) {
    fetch(`${adminBackendUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
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
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {

    // You still need to get the element references inside this scope to attach listeners to them
    const userSearchButton = document.getElementById('user-search-button');
    const createEventForm = document.getElementById('create-event-form');
    const closeModalButton = document.querySelector('.close-button');
    const seatModal = document.getElementById('seat-modal');
    const confirmSeatBookingBtn = document.getElementById('confirm-seat-booking-btn');
    const switchModeBtn = document.getElementById('switch-mode-btn');

    userSearchButton.addEventListener('click', () => {
        const searchTerm = document.getElementById('user-search-input').value;
        fetchEvents(searchTerm);
    });

    createEventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('event-name').value;
        const venue = document.getElementById('event-venue').value;
        const startTime = document.getElementById('event-start-time').value;
        const capacity = document.getElementById('event-capacity').value;

        const eventData = {
            name,
            venue,
            start_time: startTime + ":00Z",
            total_capacity: parseInt(capacity)
        };
        createEvent(eventData);
    });

    closeModalButton.addEventListener('click', closeSeatModal);

    window.addEventListener('click', (event) => {
        if (event.target == seatModal) {
            closeSeatModal();
        }
    });

    confirmSeatBookingBtn.addEventListener('click', bookSelectedSeats);

    switchModeBtn.addEventListener('click', () => {
        if (isAdmin) {
            showUserMode();
        } else {
            showAdminMode();
        }
    });

    // Initial load call
    showUserMode();
});