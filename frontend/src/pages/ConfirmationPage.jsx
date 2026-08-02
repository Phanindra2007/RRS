import { useLocation } from 'react-router-dom';

function berthText(berthType) {
  return (
    {
      LB: 'Lower Berth',
      MB: 'Middle Berth',
      UB: 'Upper Berth',
      SL: 'Side Lower',
      SU: 'Side Upper'
    }[berthType] || berthType
  );
}

export default function ConfirmationPage() {
  const { state } = useLocation();

  if (!state) return <p className="card">No booking data found.</p>;

  return (
    <section className="card">
      <h2>Booking Confirmation</h2>
      <p>PNR: {state.pnr}</p>
      <p>Train: {state.trainName}</p>
      <p>Class: {state.className}</p>
      <p>Total Fare: ₹{state.fare}</p>

      {state.ticketStatus === 'CNF' ? (
        <p className="highlight">
          Coach {state.seat.coachNumber} - Seat {state.seat.seatNumber} ({berthText(state.seat.berthType)})
        </p>
      ) : (
        <p className="highlight">WL Position: {state.wlPosition}</p>
      )}
    </section>
  );
}
