import psycopg2
from flask import Flask, request
from flask_cors import CORS

# This creates your web app
app = Flask(__name__)
CORS(app) # 
import os


def get_db_connection():
    # Render provides a single DATABASE_URL environment variable.
    # We'll check for that first, as it's the standard for Render.
    database_url = os.environ.get("DATABASE_URL")
    
    if database_url:
        # Use the single URL for the deployed app
        return psycopg2.connect(database_url, sslmode="require")
    else:
        # Fallback to individual variables for local testing
        conn = psycopg2.connect(
            host=os.environ.get("DB_HOST", "localhost"),
            database=os.environ.get("DB_NAME", "evently"),
            user=os.environ.get("DB_USER", "evently_user"),
            password=os.environ.get("DB_PASS", "evently_password"),
            port=os.environ.get("DB_PORT", 5432)
        )
        return conn

import json


@app.route('/events')
def get_all_events():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get search term from the URL
        search_term = request.args.get('search')
        
        sql = "SELECT id, name, venue, start_time, total_capacity, tickets_booked FROM events"
        params = []
        
        # If a search term exists, modify the query
        if search_term:
            sql += " WHERE name ILIKE %s OR venue ILIKE %s"
            params.append(f"%{search_term}%")
            params.append(f"%{search_term}%")
        
        cur.execute(sql, tuple(params)) # This is the key line to ensure it works
        
        events = cur.fetchall()

        events_list = []
        for event in events:
            events_list.append({
                "id": event[0],
                "name": event[1],
                "venue": event[2],
                "start_time": str(event[3]),
                "total_capacity": event[4],
                "tickets_booked": event[5]
            })

        return json.dumps(events_list)

    except Exception as e:
        return f"An error occurred: {e}", 500

    finally:
        if conn:
            conn.close()
from flask import request

@app.route('/events/<int:event_id>')
def get_event(event_id):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Get the name or venue from the URL, if they exist
        name = request.args.get('name')
        venue = request.args.get('venue')
        
        sql = "SELECT id, name, venue, start_time, total_capacity, tickets_booked FROM events WHERE id = %s"
        params = [event_id]

        # Add additional search terms if provided
        if name:
            sql += " OR name ILIKE %s"
            params.append(name)
        if venue:
            sql += " OR venue ILIKE %s"
            params.append(venue)

        cur.execute(sql, tuple(params))
        event = cur.fetchone()

        if event is None:
            return {"error": "Event not found"}, 404

        event_dict = {
            "id": event[0],
            "name": event[1],
            "venue": event[2],
            "start_time": str(event[3]),
            "total_capacity": event[4],
            "tickets_booked": event[5]
        }

        return event_dict

    except Exception as e:
        return {"error": str(e)}, 500
    finally:
        if conn:
            conn.close()

@app.route('/admin/events', methods=['POST'])
def create_event():
    conn = None
    try:
        # Get the event data that the admin sent
        event_data = request.get_json()
        name = event_data['name']
        venue = event_data['venue']
        start_time = event_data['start_time']
        total_capacity = event_data['total_capacity']

        conn = get_db_connection()
        cur = conn.cursor()

        # Add the new event to the events table
        cur.execute(
            "INSERT INTO events (name, venue, start_time, total_capacity) VALUES (%s, %s, %s, %s) RETURNING id;",
            (name, venue, start_time, total_capacity)
        )
        new_event_id = cur.fetchone()[0]
        conn.commit()

        return {"message": "Event created successfully!", "id": new_event_id}, 201

    except Exception as e:
        if conn:
            conn.rollback() # Undo any changes if there was an error
        return {"error": f"An error occurred: {e}"}, 500
    finally:
        if conn:
            cur.close()
            conn.close()

            # Clean up
# This is your first test to see if the connection works
@app.route('/test-db-connection')
def test_db_connection():
    try:
        conn = get_db_connection()
        conn.close()
        return "Database connection successful!"
    except Exception as e:
        return f"Database connection failed. Error: {e}"

from flask import jsonify

@app.route('/bookings', methods=['POST'])
def create_booking():
    conn = None
    try:
        booking_data = request.get_json()
        user_id = booking_data['user_id']
        event_id = booking_data['event_id']
        seat_numbers = booking_data['seat_numbers'] # Now expects a list of seat numbers

        if not isinstance(seat_numbers, list):
            return {"error": "Invalid input. 'seat_numbers' must be a list."}, 400

        conn = get_db_connection()
        cur = conn.cursor()
        
        # Lock all selected seats for the event
        for seat_number in seat_numbers:
            cur.execute("SELECT is_available FROM seats WHERE event_id = %s AND seat_number = %s FOR UPDATE;",
                        (event_id, seat_number))
            seat = cur.fetchone()

            if seat is None:
                return {"error": f"Seat {seat_number} not found."}, 404
            
            is_available = seat[0]
            if not is_available:
                return {"error": f"Seat {seat_number} is already booked."}, 409

        # If all seats are available, proceed with booking
        for seat_number in seat_numbers:
            # Update the seats table
            cur.execute("UPDATE seats SET is_available = FALSE WHERE event_id = %s AND seat_number = %s;",
                        (event_id, seat_number))
            
            # Insert into bookings table
            cur.execute(
                "INSERT INTO bookings (user_id, event_id, seat_number) VALUES (%s, %s, %s);",
                (user_id, event_id, seat_number)
            )

        conn.commit()
        return {"message": f"Booking successful for {len(seat_numbers)} seats!"}, 201

    except Exception as e:
        if conn:
            conn.rollback()
        return {"error": f"An error occurred: {e}"}, 500
    finally:
        if conn:
            cur.close()
            conn.close()

from flask import request

@app.route('/bookings/<int:booking_id>', methods=['DELETE'])
def cancel_booking(booking_id):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Step 1: Find the booking to get the event_id
        cur.execute("SELECT event_id FROM bookings WHERE id = %s;", (booking_id,))
        booking = cur.fetchone()

        if booking is None:
            return {"error": "Booking not found"}, 404

        event_id = booking[0]

        # Step 2: Delete the booking from the bookings table
        cur.execute("DELETE FROM bookings WHERE id = %s;", (booking_id,))

        # Step 3: Decrease the tickets_booked count on the event
        cur.execute("UPDATE events SET tickets_booked = tickets_booked - 1 WHERE id = %s;", (event_id,))

        conn.commit()
        return {"message": "Booking canceled successfully"}

    except Exception as e:
        if conn:
            conn.rollback()
        return {"error": f"An error occurred: {e}"}, 500
    finally:
        if conn:
            conn.close()


@app.route('/events/<int:event_id>/seats')
def get_event_seats(event_id):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT seat_number, is_available FROM seats WHERE event_id = %s ORDER BY seat_number;", (event_id,))
        seats = cur.fetchall()

        seats_list = []
        for seat in seats:
            seats_list.append({
                "seat_number": seat[0],
                "is_available": seat[1]
            })

        return jsonify(seats_list)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/admin/events/<int:event_id>/generate-seats', methods=['POST'])
def generate_seats_api(event_id):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Get the total capacity of the event
        cur.execute("SELECT total_capacity FROM events WHERE id = %s;", (event_id,))
        capacity = cur.fetchone()

        if capacity is None:
            return {"error": "Event not found"}, 404
        
        total_capacity = capacity[0]
        
        # Check if seats already exist to prevent duplicates
        cur.execute("SELECT COUNT(*) FROM seats WHERE event_id = %s;", (event_id,))
        if cur.fetchone()[0] > 0:
            return {"error": "Seats already generated for this event"}, 409
        
        # Insert the seats using the generate_series function
        cur.execute(
            "INSERT INTO seats (event_id, seat_number, is_available) SELECT %s, generate_series(1, %s)::TEXT, TRUE;",
            (event_id, total_capacity)
        )
        conn.commit()
        return {"message": f"Successfully generated {total_capacity} seats for event {event_id}!"}, 201

    except Exception as e:
        if conn:
            conn.rollback()
        return {"error": f"An error occurred: {e}"}, 500
    finally:
        if conn:
            cur.close()
            conn.close()


@app.route('/users/<int:user_id>/bookings')
def get_user_bookings(user_id):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Step 1: Find all bookings for this user and get event details
        cur.execute(
            "SELECT e.name, e.venue, e.start_time, b.booking_time "
            "FROM bookings b JOIN events e ON b.event_id = e.id "
            "WHERE b.user_id = %s;",
            (user_id,)
        )
        bookings = cur.fetchall()

        bookings_list = []
        for booking in bookings:
            bookings_list.append({
                "event_name": booking[0],
                "venue": booking[1],
                "start_time": str(booking[2]),
                "booking_time": str(booking[3])
            })

        return {"bookings": bookings_list}

    except Exception as e:
        return {"error": f"An error occurred: {e}"}, 500
    finally:
        if conn:
            conn.close()
    
from flask import jsonify

@app.route('/admin/analytics')
def get_analytics():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Get total number of bookings
        cur.execute("SELECT COUNT(*) FROM bookings;")
        total_bookings = cur.fetchone()[0]

        # Get most popular events
        cur.execute(
            "SELECT e.name, COUNT(b.id) AS booking_count "
            "FROM bookings b JOIN events e ON b.event_id = e.id "
            "GROUP BY e.name "
            "ORDER BY booking_count DESC LIMIT 5;"
        )
        popular_events = cur.fetchall()

        popular_events_list = []
        for event in popular_events:
            popular_events_list.append({
                "event_name": event[0],
                "booking_count": event[1]
            })

        # Return all the analytics data
        return jsonify({
            "total_bookings": total_bookings,
            "most_popular_events": popular_events_list
        })

    except Exception as e:
        return jsonify({"error": f"An error occurred: {e}"}), 500
    finally:
        if conn:
            cur.close()
            conn.close()


@app.route('/admin/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Start a transaction to ensure all deletions are successful
        conn.autocommit = False

        # Delete all bookings related to the event
        cur.execute("DELETE FROM bookings WHERE event_id = %s;", (event_id,))

        # Delete all seats related to the event
        cur.execute("DELETE FROM seats WHERE event_id = %s;", (event_id,))

        # Finally, delete the event itself
        cur.execute("DELETE FROM events WHERE id = %s;", (event_id,))
        
        conn.commit()
        return {"message": "Event and related data deleted successfully!"}, 200

    except Exception as e:
        if conn:
            conn.rollback()
        return {"error": f"An error occurred: {e}"}, 500
    finally:
        if conn:
            cur.close()
            conn.close()

from flask import request

# New route to create a user
@app.route('/users', methods=['POST'])
def create_user():
    conn = None
    try:
        user_data = request.get_json()
        name = user_data['name']
        email = user_data['email']

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            "INSERT INTO users (name, email) VALUES (%s, %s) RETURNING id;",
            (name, email)
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        return {"message": "User created successfully!", "id": user_id}, 201
    except Exception as e:
        if conn: conn.rollback()
        return {"error": str(e)}, 500
    finally:
        if conn: conn.close()
# A simple check to protect admin routes
def is_admin(api_key):
    # This is a very simple check. A real app would use a database and tokens.
    return api_key == 'super_secret_admin_key'

# Example of how to use it
@app.route('/admin/events', methods=['POST'])
def create_event_secure():
    api_key = request.headers.get('X-API-Key')
    if not is_admin(api_key):
        return {"error": "Unauthorized"}, 401
    
    # The rest of your existing create_event code goes here...

# This runs the app on your computer
if __name__ == '__main__':
    app.run(debug=True)