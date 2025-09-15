# Evently Backend System

### Introduction
Evently is a scalable backend service designed to handle ticket bookings for large-scale events. This project was built to demonstrate proficiency in handling key backend challenges such as concurrency, API design, and scalability.

### Key Features
* **Event Browsing:** Users can browse a list of events and search by name or venue.
* **Seat-Level Booking:** Users can select and book one or more specific seats from a visual map.
* **Event Management:** Admins can create, delete, and manage events.
* **Booking Analytics:** Admins can view analytics like total bookings and popular events.

### Design Decisions & Scalability
* **Concurrency:** To prevent overselling, a **pessimistic locking** strategy was implemented using database transactions. The `SELECT ... FOR UPDATE` command ensures that only one booking request for a specific seat can be processed at a time.
* **Database Schema:** A relational database (PostgreSQL) was chosen to ensure ACID compliance for booking transactions. Key entities modeled include `users`, `events`, `bookings`, and `seats`.
* **API Design:** The system uses a RESTful API with clear, logical endpoints and proper HTTP status codes for error handling (e.g., `404 Not Found`, `409 Conflict`).

### Challenges Faced
A significant challenge was connecting the local frontend to the backend due to **CORS errors**. This was solved by adding the `Flask-CORS` extension to the backend to allow cross-origin requests. Another challenge was the manual setup of the database and its schema, which was overcome by creating and running specific SQL commands.

### API Documentation
The backend exposes the following endpoints:
* `GET /events`: Browse and search events.
* `GET /events/{id}/seats`: Get seat map for a specific event.
* `POST /bookings`: Book one or more seats.
* `POST /admin/events`: Create a new event.
* `DELETE /admin/events/{id}`: Delete an event and all its data.
* `GET /admin/analytics`: View booking insights.
