import './Info.css';
import { useState } from 'react';

function Info() {
  const [trip, setTrip] = useState({
    from: '',
    to: '',
    date: '',
    seats: '',
    coachType: ''
  });

  const [passengers, setPassengers] = useState([
    { lastName: '', firstName: '', birthDate: '', document: '' },
    { lastName: '', firstName: '', birthDate: '', document: '' }
  ]);

  const handleTripChange = (e) => {
    const { name, value } = e.target;
    setTrip((prev) => ({ ...prev, [name]: name === 'seats' ? Number(value) : value }));

    if (name === 'seats') {
      const newCount = Number(value);
      setPassengers((prev) => {
        const copy = [...prev];
        if (newCount > copy.length) {
          while (copy.length < newCount) {
            copy.push({ lastName: '', firstName: '', birthDate: '', document: '' });
          }
        } else {
          copy.length = newCount;
        }
        return copy;
      });
    }
  };

  const handlePassengerChange = (index, e) => {
    const { name, value } = e.target;
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index][name] = value;
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      trip,
      passengers
    };

    try {
      const response = await fetch('http://localhost:3001/save-passengers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        alert('✅ Дані успішно збережено у passengers.json!');
      } else {
        alert('❌ Помилка при збереженні даних');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Сервер не відповідає');
    }
  };

  const handleRun = async () => {
    const data = { trip, passengers };

    try {
      const response = await fetch("http://localhost:3001/run-uz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (response.ok) {
        alert("🚂 Скрипт запущено!\n" + result.message);
      } else {
        alert("❌ Помилка: " + result.error);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Сервер не відповідає");
    }
  };

  return (
    <div className="info-form">
      <h2>Інформація про поїздку</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Звідки:
          <input type="text" name="from" value={trip.from} onChange={handleTripChange} />
        </label>
        <label>
          Куди:
          <input type="text" name="to" value={trip.to} onChange={handleTripChange} />
        </label>
        <label>
          Дата:
          <input type="date" name="date" value={trip.date} onChange={handleTripChange} />
        </label>
        <label>
          Кількість місць:
          <input type="number" name="seats" min="1" max="10" value={trip.seats} onChange={handleTripChange} />
        </label>
        <label>
          Тип вагона:
          <select name="coachType" value={trip.coachType} onChange={handleTripChange}>
            <option value="">-- виберіть --</option>
            <option value="Плацкарт">Плацкарт</option>
            <option value="Купе">Купе</option>
            <option value="СВ">СВ</option>
          </select>
        </label>

        <h3>Пасажири</h3>
        {passengers.map((p, index) => (
          <div key={index} className="passenger">
            <label>
              Прізвище:
              <input
                type="text"
                name="lastName"
                value={p.lastName}
                onChange={(e) => handlePassengerChange(index, e)}
              />
            </label>
            <label>
              Ім'я:
              <input
                type="text"
                name="firstName"
                value={p.firstName}
                onChange={(e) => handlePassengerChange(index, e)}
              />
            </label>
            <label>
              Дата народження:
              <input
                type="date"
                name="birthDate"
                value={p.birthDate}
                onChange={(e) => handlePassengerChange(index, e)}
              />
            </label>
            <label>
              Документ:
              <input
                type="text"
                name="document"
                value={p.document}
                onChange={(e) => handlePassengerChange(index, e)}
              />
            </label>
          </div>
        ))}

        <button type="submit">Зберегти</button>
        <button type="button" onClick={handleRun}>Запустити</button>
      </form>
    </div>
  );
}

export default Info;
