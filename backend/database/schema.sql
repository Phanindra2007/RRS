CREATE DATABASE IF NOT EXISTS railway_reservation_system;
USE railway_reservation_system;

CREATE TABLE IF NOT EXISTS `USER` (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(15),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ADMIN (
  admin_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS STATION (
  station_id INT PRIMARY KEY AUTO_INCREMENT,
  station_name VARCHAR(100) NOT NULL,
  station_code VARCHAR(10) NOT NULL UNIQUE,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL
);

CREATE INDEX idx_station_code ON STATION(station_code);

CREATE TABLE IF NOT EXISTS TRAIN (
  train_id INT PRIMARY KEY AUTO_INCREMENT,
  train_name VARCHAR(100) NOT NULL,
  train_number VARCHAR(20) NOT NULL UNIQUE,
  total_distance_km INT NOT NULL,
  managed_by_admin INT,
  CONSTRAINT fk_train_admin FOREIGN KEY (managed_by_admin) REFERENCES ADMIN(admin_id)
);

CREATE INDEX idx_train_number ON TRAIN(train_number);

CREATE TABLE IF NOT EXISTS ROUTE (
  route_id INT PRIMARY KEY AUTO_INCREMENT,
  train_id INT NOT NULL,
  station_id INT NOT NULL,
  stop_number INT NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  distance_from_source INT NOT NULL,
  CONSTRAINT fk_route_train FOREIGN KEY (train_id) REFERENCES TRAIN(train_id),
  CONSTRAINT fk_route_station FOREIGN KEY (station_id) REFERENCES STATION(station_id),
  CONSTRAINT uq_route_stop UNIQUE (train_id, stop_number)
);

CREATE TABLE IF NOT EXISTS `CLASS` (
  class_id INT PRIMARY KEY AUTO_INCREMENT,
  class_name VARCHAR(20) NOT NULL UNIQUE,
  fare_per_km DECIMAL(10,2) NOT NULL CHECK (fare_per_km >= 0)
);

CREATE TABLE IF NOT EXISTS `SCHEDULE` (
  schedule_id INT PRIMARY KEY AUTO_INCREMENT,
  train_id INT NOT NULL,
  run_date DATE NOT NULL,
  departure_time DATETIME NOT NULL,
  arrival_time DATETIME NOT NULL,
  CONSTRAINT fk_schedule_train FOREIGN KEY (train_id) REFERENCES TRAIN(train_id),
  CONSTRAINT uq_schedule UNIQUE (train_id, run_date)
);

CREATE TABLE IF NOT EXISTS SEAT (
  seat_id INT PRIMARY KEY AUTO_INCREMENT,
  train_id INT NOT NULL,
  class_id INT NOT NULL,
  coach_number VARCHAR(10) NOT NULL,
  seat_number INT NOT NULL,
  berth_type ENUM('LLB','LMB','LUB','RLB','RMB','RUB','SL','SU') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_seat_train FOREIGN KEY (train_id) REFERENCES TRAIN(train_id),
  CONSTRAINT fk_seat_class FOREIGN KEY (class_id) REFERENCES `CLASS`(class_id),
  CONSTRAINT uq_seat UNIQUE (train_id, class_id, coach_number, seat_number)
);

CREATE TABLE IF NOT EXISTS SEAT_ALLOCATION (
  allocation_id INT PRIMARY KEY AUTO_INCREMENT,
  schedule_id INT NOT NULL,
  seat_id INT NOT NULL,
  status ENUM('AVAILABLE','BOOKED') NOT NULL DEFAULT 'AVAILABLE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_allocation_schedule FOREIGN KEY (schedule_id) REFERENCES `SCHEDULE`(schedule_id),
  CONSTRAINT fk_allocation_seat FOREIGN KEY (seat_id) REFERENCES SEAT(seat_id),
  CONSTRAINT uq_allocation UNIQUE (schedule_id, seat_id)
);

CREATE TABLE IF NOT EXISTS BOOKING (
  booking_id INT PRIMARY KEY AUTO_INCREMENT,
  pnr_number VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  schedule_id INT NOT NULL,
  class_id INT NOT NULL,
  source_station_id INT NOT NULL,
  destination_station_id INT NOT NULL,
  booking_status ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  total_fare DECIMAL(10,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES `USER`(user_id),
  CONSTRAINT fk_booking_schedule FOREIGN KEY (schedule_id) REFERENCES `SCHEDULE`(schedule_id),
  CONSTRAINT fk_booking_class FOREIGN KEY (class_id) REFERENCES `CLASS`(class_id),
  CONSTRAINT fk_booking_source FOREIGN KEY (source_station_id) REFERENCES STATION(station_id),
  CONSTRAINT fk_booking_destination FOREIGN KEY (destination_station_id) REFERENCES STATION(station_id)
);

CREATE INDEX idx_booking_pnr ON BOOKING(pnr_number);
CREATE INDEX idx_booking_user ON BOOKING(user_id);
CREATE INDEX idx_booking_schedule ON BOOKING(schedule_id);

-- why BOOKING.class_id is not redundant because, PASSENGER.seat_id only gets allocated if seats are available in the same class as the booking. So, we can use BOOKING.class_id to filter passengers in the waiting list for a specific class.

CREATE TABLE IF NOT EXISTS PASSENGER (
  passenger_id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  passenger_name VARCHAR(100) NOT NULL,
  age INT NOT NULL,
  gender ENUM('M','F','O') NOT NULL,
  berth_preference ENUM('LLB','LMB','LUB','RLB','RMB','RUB','SL','SU') DEFAULT NULL,
  ticket_status ENUM('CNF','WL') NOT NULL,
  seat_id INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_passenger_booking FOREIGN KEY (booking_id) REFERENCES BOOKING(booking_id),
  CONSTRAINT fk_passenger_seat FOREIGN KEY (seat_id) REFERENCES SEAT(seat_id),
  CONSTRAINT chk_passenger_seat_status CHECK ((ticket_status='CNF' AND seat_id IS NOT NULL) OR (ticket_status='WL' AND seat_id IS NULL))
);

CREATE TABLE IF NOT EXISTS PAYMENT (
  payment_id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('UPI','CARD','NET_BANKING','WALLET','CASH') NOT NULL,
  payment_status ENUM('SUCCESS','FAILED','PENDING') NOT NULL,
  paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES BOOKING(booking_id)
);

CREATE TABLE IF NOT EXISTS CANCELLATION (
  cancellation_id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  cancelled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  cancellation_charge DECIMAL(10,2) NOT NULL,
  refund_amount DECIMAL(10,2) NOT NULL,
  freed_seat_id INT DEFAULT NULL,
  CONSTRAINT fk_cancellation_booking FOREIGN KEY (booking_id) REFERENCES BOOKING(booking_id),
  CONSTRAINT fk_cancellation_freed_seat FOREIGN KEY (freed_seat_id) REFERENCES SEAT(seat_id)
);

CREATE TABLE IF NOT EXISTS WAITING_LIST (
  waiting_id INT PRIMARY KEY AUTO_INCREMENT,
  passenger_id INT NOT NULL UNIQUE,
  wl_position INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_waiting_passenger FOREIGN KEY (passenger_id) REFERENCES PASSENGER(passenger_id)
);

DELIMITER $$
DROP TRIGGER IF EXISTS trg_promote_waiting_list_after_cancel $$
CREATE TRIGGER trg_promote_waiting_list_after_cancel
AFTER INSERT ON CANCELLATION
FOR EACH ROW
trg_block: BEGIN
  DECLARE v_schedule_id INT;
  DECLARE v_class_id INT;
  DECLARE v_waiting_id INT;
  DECLARE v_waiting_passenger_id INT;
  DECLARE v_waiting_position INT;

  IF NEW.freed_seat_id IS NULL THEN
    LEAVE trg_block;
  END IF;

  SELECT b.schedule_id
  INTO v_schedule_id
  FROM BOOKING b
  WHERE b.booking_id = NEW.booking_id
  LIMIT 1;

  SELECT s.class_id
  INTO v_class_id
  FROM SEAT s
  WHERE s.seat_id = NEW.freed_seat_id
  LIMIT 1;

  SELECT wl.waiting_id, p.passenger_id, wl.wl_position
  INTO v_waiting_id, v_waiting_passenger_id, v_waiting_position
  FROM WAITING_LIST wl
  JOIN PASSENGER p ON p.passenger_id = wl.passenger_id
  JOIN BOOKING b ON b.booking_id = p.booking_id
  WHERE b.schedule_id = v_schedule_id
    AND b.class_id = v_class_id
  ORDER BY wl.wl_position
  LIMIT 1;

  IF v_waiting_id IS NOT NULL THEN
    UPDATE PASSENGER
    SET ticket_status = 'CNF', seat_id = NEW.freed_seat_id
    WHERE passenger_id = v_waiting_passenger_id;

    DELETE FROM WAITING_LIST WHERE waiting_id = v_waiting_id;

    -- exact waiting list position is not important, just relative order is what we care.
    -- UPDATE WAITING_LIST wl
    -- JOIN PASSENGER p ON p.passenger_id = wl.passenger_id
    -- JOIN BOOKING b ON b.booking_id = p.booking_id
    -- SET wl.wl_position = wl.wl_position - 1
    -- WHERE b.schedule_id = v_schedule_id
    --   AND b.class_id = v_class_id
    --   AND wl.wl_position > v_waiting_position;
  END IF;
END $$
DELIMITER ;

--`DELIMITER $$` = for this block, stop using `;` as the end marker, `END $$` = this trigger definition ends here, `DELIMITER ;` = go back to normal `;`
--A seat became free, Find the next person waiting for that same journey and class, Give them that seat, Move the remaining waiting-list positions up