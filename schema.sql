-- Create the users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

-- Create the events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    total_capacity INTEGER NOT NULL,
    tickets_booked INTEGER NOT NULL DEFAULT 0
);

-- Create the bookings table
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    event_id INTEGER NOT NULL REFERENCES events(id),
    booking_time TIMESTAMP NOT NULL DEFAULT NOW(),
    -- You would run this command in your psql terminal
ALTER TABLE bookings ADD COLUMN seat_number VARCHAR(10) NOT NULL;
);

-- Create the seats table
CREATE TABLE seats (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    seat_number VARCHAR(10) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (event_id, seat_number)
);